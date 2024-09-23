#!/bin/bash
# Скрипт устанавливает среду для последующей компиляции, берет исходники зависимостей из github, но не собирает

INSTALL_PATH=$PWD

# Инициализация и обновление git submodules
git submodule init
git submodule update

# Запуск специфического скрипта установки в source-server
cd ./source-server
./control-install.sh
cd $INSTALL_PATH

# Установка библиотек через custom скрипт
./tools/install-repo-libs.sh

# Дополнительные зависимости
LIB_NAME=("libglib2.0-dev" "cmake" "libtool-bin" "pkg-config" "build-essential" "autoconf" "automake" "curl" "python")
LIB_OK="Status: install ok installed"
F_UL=0

### Установка зависимостей через APT ###
for i in "${LIB_NAME[@]}"; do
    L1=$(dpkg -s $i | grep 'install ok')
    echo "CHECK $i .... $L1"

    if [ "$L1" != "$LIB_OK" ]; then
        if [ $F_UL == 0 ]; then
            sudo apt-get update
            F_UL=1
        fi
        echo "INSTALL $i"
        sudo apt-get install -y $i
    fi
done

# Дополнительно устанавливаем gdb и другие инструменты для отладки
sudo apt-get install -y build-essential gdb

### Установка или обновление Rust ###
if [ "$1" = "force" ] || ! command -v rustc >/dev/null; then
    echo "--- INSTALLING RUST ---"
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    #source $HOME/.cargo/env
    . $HOME/.cargo/env
else
    echo "--- UPDATING RUST ---"
    rustup update stable
fi

rustup default 1.75

# Проверка версий rustc и cargo
whereis rustc
rustc -V
cargo -V

# ./tools/install-oxigraph.sh  # Закомментировано, если нужно использовать в будущем
