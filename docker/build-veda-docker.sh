BUILD_PATH=$PWD
cp -r veda-docker /tmp
cp -r ./../public /tmp/veda-docker/veda
cp -r ./../bin /tmp/veda-docker/veda
cp -r ./../ontology /tmp/veda-docker/veda/dist
cd /tmp/veda-docker
docker build --no-cache -t s7m7/veda:0.0.1 .
rm -r /tmp/veda-docker
cd $BUILD_PATH
