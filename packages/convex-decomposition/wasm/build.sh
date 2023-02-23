#!/bin/bash

mkdir wasm_build
cd wasm_build
emcmake cmake -DCMAKE_TOOLCHAIN_FILE=~/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake ..
emmake make

cd ..
