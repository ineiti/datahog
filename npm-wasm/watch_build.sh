while clear; date; do wasm-pack build -t web; fswatch -1 src; done
