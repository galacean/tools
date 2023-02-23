const fs = require('fs');
const path = require('path');

const EXT = ['.png', '.jpg', '.jpeg'];

export async function findAllImageFilesSync(inputFiles: Array<string>, outFiles: Array<string>) {
  for (let i = 0, l = inputFiles.length; i < l; ++i) {
    let inputFile = inputFiles[i];

    // Handle url
    if (inputFile.startsWith('http://') || inputFile.startsWith('https://')) {
      const ext = path.extname(inputFile);
      if (EXT.indexOf(ext) !== -1) {
        outFiles.push(inputFile);
      }

      continue;
    }

    const file = path.resolve(inputFile);
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(file);
        files.map((curFile: string, i: number) => {
          files[i] = path.join(file, curFile);
        });
        await findAllImageFilesSync(files, outFiles);
      } else {
        const ext = path.extname(file);
        if (EXT.indexOf(ext) !== -1) {
          outFiles.push(file);
        }
      }
    }
  }
}

