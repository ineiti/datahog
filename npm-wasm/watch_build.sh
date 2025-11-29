#!/bin/bash

while clear; do
  date
  wasm-pack build -t web -d pkg.new
  cp -av pkg.new/* pkg
  fswatch -1 src ../datahog || exit
done
