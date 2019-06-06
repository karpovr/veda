mkdir chunk-io

zip -v -r ./chunk-io/logs.zip logs
zip -v -r ./chunk-io/logs.zip data
zip -v -r ./chunk-io/logs.zip screens
zip -v -r ./chunk-io/logs.zip qa
zip -v ./chunk-io/logs.zip core
zip -v ./chunk-io/logs.zip install.log

cd chunk-io

count=$(git ls-files -o | wc -l)
echo "COUNT=$count"
git ls-files -o

echo ">>>>>>>>> CONTAINERS LOG FILES <<<<<<<<<<<<"

for (( i=1; i<="$count";i++ ))

do

file=$(echo $(git ls-files -o | sed "${i}q;d"))

echo "FILE=$file"

cat $file | curl -u semantic_machines:8b8nfecIhO -sT - chunk.io

done

#echo " >>>>> testsummary log file <<<< "

#cat testsummary.log | curl -sT - chunk.io
