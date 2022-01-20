#!/bin/bash
cd ./watch && ./start.sh && cd ..
nohup npm run watch | tee watch.log &