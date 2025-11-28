while clear; do 
  date
  wasm-pack build -t web -d pkg.new
  cp -a pkg.new/* pkg
  fswatch -1 src
done
