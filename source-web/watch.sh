#!/bin/bash
cd ./watch && ./start.sh && cd ..
nohup npm run watch > watch.log 2>&1 &