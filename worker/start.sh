#!/bin/bash
#
# BriefTube Worker — Start via systemd
#
sudo systemctl start brieftube-worker
sudo systemctl status brieftube-worker --no-pager
