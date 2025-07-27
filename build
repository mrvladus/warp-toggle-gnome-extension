#!/usr/bin/bash

NAME=warptoggle@mrvladus.github.io
DESTDIR=~/.local/share/gnome-shell/extensions/$NAME

if [ "$1" == "install" ]; then
    echo "Installing WARP Toggle extension"
    rm -rf $DESTDIR
    mkdir -p $DESTDIR
    cp extension.js $DESTDIR
    cp metadata.json $DESTDIR
    echo "Success"
    exit 0
fi

if [ "$1" == "uninstall" ]; then
    echo "Unnstalling WARP Toggle extension"
    rm -rf $DESTDIR
    echo "Success"
    exit 0
fi

if [ "$1" == "zip" ]; then
    echo "Creating zip"
    rm -rf "${NAME}.zip"
    zip "${NAME}.zip" extension.js metadata.json
    echo "Success"
    exit 0
fi
