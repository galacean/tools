cmake_minimum_required(VERSION 3.24)
project(v_hacd_js)

# -pthread
SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++17 -fno-exceptions -ffunction-sections -fdata-sections -fstrict-aliasing ${CLANG_WARNINGS}")

set(CMAKE_CXX_STANDARD 17)

add_executable(v_hacd_js vhacd.cpp)

include_directories(
        ~/emsdk/upstream/emscripten/system/include
)

SET(EMSCRIPTEN_USE_ASSERTIONS "1")
# -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4
SET(EMSCRIPTEN_BASE_OPTIONS "--bind -s MODULARIZE=1  -s EXPORT_NAME=VHACD -s ALLOW_MEMORY_GROWTH=1")

SET_TARGET_PROPERTIES(v_hacd_js PROPERTIES
        LINK_FLAGS "-O3 ${EMSCRIPTEN_BASE_OPTIONS} -s ASSERTIONS=${EMSCRIPTEN_USE_ASSERTIONS}"
        )

# name the output library 'v-hacd' as this is really a union of all of js-bound VHACD
set_target_properties(v_hacd_js PROPERTIES OUTPUT_NAME "v_hacd${CMAKE_BUILD_TYPE}")