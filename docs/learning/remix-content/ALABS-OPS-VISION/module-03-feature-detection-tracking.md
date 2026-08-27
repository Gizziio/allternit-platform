# Feature Detection & Tracking

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

Features are the salient points in an image that computers can track and match across frames. This module covers classical feature detection (Harris, SIFT, ORB) and object tracking (optical flow, Kalman filters). These techniques are essential for agents that need to monitor changes in visual scenes over time.

## Learning Objectives

- [ ] Detect and describe image features using SIFT and ORB.
[ ] Match features between two images to find correspondences.
[ ] Implement basic object tracking using optical flow and contour tracking.

## Lecture Guide

**Source:** OpenCV official documentation + free computer vision tutorials

1. **What are Features?** — Corners, edges, blobs, and regions of interest.
2. **Harris Corner Detection** — Finding corner points in images.
3. **Shi-Tomasi Corners** — An improved corner detection algorithm.
4. **SIFT** — Scale-Invariant Feature Transform for robust matching.
5. **SURF & ORB** — Faster alternatives to SIFT.
6. **Feature Descriptors** — Representing local patches as vectors.
7. **Feature Matching** — Brute-force and FLANN-based matchers.
8. **Homography** — Finding perspective transforms from feature matches.
9. **Optical Flow** — Tracking pixel movement between frames.
10. **Lucas-Kanade Method** — Sparse optical flow for point tracking.
11. **Dense Optical Flow** — Motion estimation for every pixel.
12. **Object Tracking** — Mean-shift and CAM-shift algorithms.
13. **Background Subtraction** — Detecting moving objects in video.
14. **Multi-Object Tracking** — Assigning detections to tracks over time.
15. **Real-Time Considerations** — Balancing accuracy and frame rate.

## Demo Outline (10 min)

1. Detect ORB features in two images of the same object from different angles.
2. Match the features and draw correspondences.
3. Use optical flow to track a moving object across a short video clip.

## Challenge (5 min)

> **The Feature Matcher:** Write a script that loads two images, detects ORB features in both, matches them using a brute-force matcher, and draws the top 10 matches. Save the output image.

## Allternit Connection

- **Internal system:** Allternit's screen-state analyzer uses feature detection to identify persistent UI elements across frame captures.
- **Reference repo/file:** OpenCV docs on feature detection and optical flow.
- **Key difference from standard approach:** Allternit prefers ORB over SIFT for UI analysis because it is patent-free and fast enough for real-time screen capture at 30 FPS.
