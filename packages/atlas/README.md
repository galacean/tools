# tool-atlas

Atlas tool for galacean engine

# Usage in terminal

## 1、Install

```
npm i @galacean/tools-atlas -g
```

## 2、Use command in terminal

### 2.1、pack or p

Pack images to atlas

```
// Pack images to atlas.
galacean-tool-atlas p ./atlas-test/111 -f galacean -o outputName -p 2

// Option help.
galacean-tool-atlas p -h
```

Options detail

| option         | instruction                                                |
| -------------- | ---------------------------------------------------------- |
| f/format       | the format for atlas (default: "galacean")                    |
| o/output       | output atlas filename (default: "galacean")                   |
| a/algorithm    | the algorithm for pack (default: "maxrects")               |
| ar/allowRotate | mark whether image allow rotate when pack (default: false) |
| p/padding      | between images (default: 1)                                |
| mw/maxWidth    | the texture max width (default: 1024)                      |
| mh/maxHeight   | the texture max height (default: 1024)                     |
| s/square       | the texture size forced square (default: false)            |
| pot            | the texture size forced power of 2 (default: false)        |

### 2.2、formatConversion or fc

Convert other atlas formats to galacean atlas

```
// Convert other atlas formats to galacean atlas.
galacean-tool-atlas fc -t texture-packer -o galacean-atlas

// Option help.
galacean-tool-atlas fc -h
```

Options detail

| option   | instruction                                 |
| -------- | ------------------------------------------- |
| t/type   | atlas format (default: "texture-packer")    |
| o/output | the name of output (default: "galacean-atlas") |

# Usage in node project

## 1、Install

```
npm i @galacean/tools-atlas --save
```

## 2、Call api

```
const core = require("@galacean/tools-atlas");

// Pack images to atlas.
const imageFiles = [ // the images to pack
  "./",
  "./test.png",
  "https://test/test.png"
];
core.pack(imageFiles, {
  format: 'galacean', // the format for atlas (default: "galacean")
  output: 'galacean', // output atlas filename (default: "galacean")
  algorithm: 'maxrects', // the algorithm for pack (default: "maxrects")
  allowRotate: false, // mark whether image allow rotate when pack (default: false)
  padding: 1, // between images (default: 1)
  maxWidth: 1024, // the texture max width (default: 1024)
  maxHeight: 1024, // the texture max height (default: 1024)
  square: false, // the texture size forced square (default: false)
  pot: false, // the texture size forced power of 2 (default: false)
}).then((ret) => {
  /*
  ret = {
    "code": 0, // return 0 if success
    "msg": '', // if code not 0, msg is the error info
    "info": {
      "imageFile": "", // the absolute path of the image file
      "atlasFile": "", // the absolute path of the atlas file
    }
  }
  */
});

// Convert other atlas formats to galacean atlas.
const filePath = "./test.json"; // the file exported by texture packer
core.formatConversion(filePath, {
  "type": texture-packer, // atlas format
  "output": galacean-atlas // the name of output
});
```
