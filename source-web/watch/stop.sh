#!/bin/bash

start-stop-daemon -Kp $PWD/.pid && rm .pid && rm *.log
