#!/bin/bash

start-stop-daemon -Kp $PWD/.pid && rm *.log .pid
