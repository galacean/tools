const fs = require("fs");
const path = require("path");

/**
 * 对给定目录下的每个文件执行一种操作
 * @param dirPath 目标路径
 * @param oneHandler 单个文件读取完毕后执行的函数 会传入参数 “路径”
 * @param callBack 所有文件读取完毕后执行的函数
 */
export function walkDir(
  dirPath: string,
  oneHandler: Function,
  cbHandler: Function
) {
  // 总文件数
  let fileNum = 0;
  const counter = (num: number) => {
    fileNum += num;
    if (fileNum == 0) {
      cbHandler && cbHandler();
    }
  };

  const walkDirHandler = (dirPath: string, oneHandler: Function) => {
    counter(1);
    fs.stat(dirPath, (err: Error, stats: any) => {
      // 读取文件信息
      if (err) {
        console.error("statErr【" + dirPath + "】");
        counter(-1);
      } else {
        if (stats.isDirectory()) {
          // 读文件夹
          fs.readdir(dirPath, function (err: Error, files: any) {
            if (err) {
              console.error("readdirEff【" + dirPath + "】");
              counter(-1);
            } else {
              files.forEach((filename: string) => {
                walkDirHandler(path.join(dirPath, filename), oneHandler);
              });
              counter(-1);
            }
          });
        } else if (stats.isFile()) {
          fs.readFile(dirPath, (err: Error, fileData: Buffer) => {
            if (err) {
              console.error("readFileError【" + dirPath + "】");
            } else {
              oneHandler && oneHandler(dirPath, fileData);
            }
            counter(-1);
          });
        } else {
          counter(-1);
        }
      }
    });
  };

  // 开始递归
  walkDirHandler(dirPath, oneHandler);
}
