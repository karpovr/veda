BUILD_PATH=$PWD

echo BUILD PUBLIC

cd source-web
npm install
npm run build
cd $BUILD_PATH
