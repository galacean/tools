import {
  addSH,
  decodeFaceSH,
  halfToFloat,
  scaleSH
} from "./SphericalHarmonics3Baker";

// Only open one worker for one task now.
export class WorkerManager {
  private static _callbacks: Record<
    string,
    {
      resolve: (any) => void;
    }
  > = {};
  private static _workerCache: Record<string, Worker> = {};
  private static _taskID: number = 0;

  static getWorker(functionList: Function[]): Worker {
    const codeString = this.getWorkerCodeByFunctionList(functionList);
    if (this._workerCache[codeString]) {
      return this._workerCache[codeString];
    }
    const url = this.getWorkerURLByCode(codeString);
    const worker = new Worker(url);
    this._workerCache[codeString] = worker;

    this.registerWorkerEvent(worker);
    return worker;
  }

  static registerWorkerEvent(worker: Worker) {
    worker.onmessage = (event) => {
      const data = event.data;
      const { type, taskID } = data;
      switch (type) {
        case "calculateSHFromTextureCube":
          const info = this._callbacks[taskID];
          const result: Array<number> = data.result;
          // console.log("worker result:", result);
          info.resolve(result);
          break;
      }
    };
  }

  static getURLByWorker(worker: Worker): string {
    for (let url in this._workerCache) {
      if (this._workerCache[url] === worker) {
        return url;
      }
    }
  }

  static getWorkerCodeByFunctionList(functionList: Function[]): string {
    const onmessageCode = onmessageInWorker.toString();
    const onmessageString = onmessageCode.substring(onmessageCode.indexOf("{") + 1, onmessageCode.lastIndexOf("}"));

    const combineString = `
      ${functionList.map((f) => f.toString()).join("\n")}
      ${onmessageString}
    `;

    return combineString;
  }

  static getWorkerURLByCode(codeString: string): string {
    const workerSourceURL = URL.createObjectURL(new Blob([codeString], { type: "application/javascript" }));
    return workerSourceURL;
  }

  /**
   * Bake from Cube texture and use WebWorker.
   * @param texture - Cube texture
   * @param out - SH3 for output
   */
  static calculateSHFromTextureCube(
    dataPX: Uint16Array,
    dataNX: Uint16Array,
    dataPY: Uint16Array,
    dataNY: Uint16Array,
    dataPZ: Uint16Array,
    dataNZ: Uint16Array,
    textureSize: number
  ): Promise<number[]> {
    return new Promise((resolve) => {
      const taskID = this._taskID++;
      const worker = this.getWorker([halfToFloat, addSH, scaleSH, decodeFaceSH]);
      this._callbacks[taskID] = { resolve };

      worker.postMessage({
        type: "calculateSHFromTextureCube",
        taskID,
        textureSize,
        dataPX,
        dataNX,
        dataPY,
        dataNY,
        dataPZ,
        dataNZ
      });
    });
  }
}

export function onmessageInWorker() {
  self.onmessage = function onmessage(event) {
    const data = event.data;
    const { type, taskID } = data;

    switch (type) {
      case "calculateSHFromTextureCube":
        const { textureSize, dataPX, dataNX, dataPY, dataNY, dataPZ, dataNZ } = data;
        const sh = new Float32Array(27);
        let solidAngleSum = 0;
        solidAngleSum = decodeFaceSH(dataPX, 0, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNX, 1, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataPY, 2, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNY, 3, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataPZ, 4, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNZ, 5, textureSize, solidAngleSum, sh);

        scaleSH(sh, (4 * Math.PI) / solidAngleSum);

        self.postMessage({
          type: "calculateSHFromTextureCube",
          taskID,
          result: sh
        });
        break;
    }
  };
}
