import {
  RGBEToLinear,
  RGBMToLinear,
  addSH,
  decodeFaceSH,
  scaleSH,
  gammaToLinearSpace
} from "./SphericalHarmonics3Baker";
import { DecodeMode } from "./enums/DecodeMode";

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
   * @param decodeMode - Mode of decoding texture cube, default DecodeMode.RGBM
   */
  static calculateSHFromTextureCube(
    dataPX: Uint8Array,
    dataNX: Uint8Array,
    dataPY: Uint8Array,
    dataNY: Uint8Array,
    dataPZ: Uint8Array,
    dataNZ: Uint8Array,
    textureSize: number,
    decodeMode: DecodeMode
  ): Promise<number[]> {
    return new Promise((resolve) => {
      const taskID = this._taskID++;
      const worker = this.getWorker([RGBEToLinear, RGBMToLinear, gammaToLinearSpace, addSH, scaleSH, decodeFaceSH]);
      this._callbacks[taskID] = { resolve };

      worker.postMessage({
        type: "calculateSHFromTextureCube",
        taskID,
        textureSize,
        decodeMode,
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
        const { decodeMode, textureSize, dataPX, dataNX, dataPY, dataNY, dataPZ, dataNZ } = data;
        const sh = new Float32Array(27);
        let solidAngleSum = 0;
        solidAngleSum = decodeFaceSH(dataPX, 0, decodeMode, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNX, 1, decodeMode, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataPY, 2, decodeMode, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNY, 3, decodeMode, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataPZ, 4, decodeMode, textureSize, solidAngleSum, sh);
        solidAngleSum = decodeFaceSH(dataNZ, 5, decodeMode, textureSize, solidAngleSum, sh);

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
