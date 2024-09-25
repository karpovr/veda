#!/bin/bash
# Скрипт устанавливает среду для последующей компиляции, берет исходники зависимостей из github, но не собирает

echo "=== Starting setup script ==="

INSTALL_PATH=$PWD
echo "Install path: $INSTALL_PATH"
ls $INSTALL_PATH

echo "=== Initializing and updating git submodules ==="
git submodule init
git submodule update

echo "=== Running control-install.sh in source-server directory ==="
cd ./source-server
./control-install.sh
cd $INSTALL_PATH

echo "=== Installing repository libraries ==="
./tools/install-repo-libs.sh

echo "=== Checking and installing additional dependencies ==="
LIB_NAME=("libglib2.0-dev" "cmake" "libtool-bin" "pkg-config" "build-essential" "autoconf" "automake" "curl" "python")
LIB_OK="Status: install ok installed"
F_UL=0

for i in "${LIB_NAME[@]}"; do
    echo "Checking $i..."
    L1=$(dpkg -s $i | grep 'install ok')
    echo "CHECK $i .... $L1"
    if [ "$L1" != "$LIB_OK" ]; then
        if [ $F_UL == 0 ]; then
            echo "Updating package lists..."
            sudo apt-get update
            F_UL=1
        fi
        echo "INSTALL $i"
        sudo apt-get install -y $i
    else
        echo "$i is already installed."
    fi
done

echo "=== Installing additional debugging tools ==="
sudo apt-get install -y build-essential gdb

echo "=== Checking Rust installation ==="
if [ "$1" = "force" ] || ! command -v rustc >/dev/null; then
    echo "--- INSTALLING RUST ---"
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    . $HOME/.cargo/env
else
    echo "--- UPDATING RUST ---"
    rustup update stable
fi

echo "=== Setting Rust default version to 1.75 ==="
rustup default 1.75

echo "=== Checking Rust and Cargo versions ==="
echo "rustc location:"
whereis rustc
echo "rustc version:"
rustc -V
echo "cargo version:"
cargo -V

echo "=== Setup script completed ==="
