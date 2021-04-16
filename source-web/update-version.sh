#!/bin/bash

sw="sw-simple.js"
manifest=$(find . -type f -name 'manifest')

t=$(date --iso-8601=seconds)
t=${t//[^0-9]/}
t=${t:0:14}

sed -E -i "s/(veda_version\s*=\s*)([0-9]+)/\1$t/" $sw
for i in $manifest
do
  sed -E -i "s/(\"veda_version\"\s*:\s*)([0-9]+)/\1$t/g" $i
done

echo "version = "$t