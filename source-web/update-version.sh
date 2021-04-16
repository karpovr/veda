#!/bin/bash

sw="sw-simple.js"
manifest=$(find . -type f -name 'manifest')

p=$(echo $1 | tr '[:upper:]' '[:lower:]')
t=$(date --iso-8601=seconds)
t=${t//[^0-9]/}
t=${t:0:14}

if [ "$p" == "" ] || [ "$p" == "js" ]; then
  sed -E -i "s/(veda_version\s*=\s*)([0-9]+)/\1$t/" $sw
  echo "JS version = "$t
fi

if [ "$p" == "" ] || [ "$p" == "db" ]; then
  for i in $manifest
  do
    sed -E -i "s/(\"veda_version\"\s*:\s*)([0-9]+)/\1$t/g" $i
  done
  echo "DB version = "$t
fi
