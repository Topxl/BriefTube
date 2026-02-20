#!/bin/bash
#
# BriefTube Worker — Restart via systemd
#
sudo systemctl restart brieftube-worker
sudo systemctl status brieftube-worker --no-pager
