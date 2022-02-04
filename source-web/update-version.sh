#!/bin/bash

sw=$(find ../public -type f -name 'sw.js')
sw_simple=$(find ../public -type f -name 'sw-simple.js')
manifest=$(find ../public -type f -name 'manifest')

t=$(date --iso-8601=seconds)
t=${t//[^0-9]/}
t=${t:0:14}

sed -E -i "s/(veda_version\s*=\s*)([0-9]+)/\1$t/" $sw
sed -E -i "s/(veda_version\s*=\s*)([0-9]+)/\1$t/" $sw_simple

for i in $manifest
do
  sed -E -i "s/(\"veda_version\"\s*:\s*)([0-9]+)/\1$t/g" $i
done

echo "version = "$t
