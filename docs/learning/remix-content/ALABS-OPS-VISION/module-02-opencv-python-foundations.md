# OpenCV + Python Foundations

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

OpenCV is the foundational library for computer vision. This module covers the essential OpenCV operations in Python: image loading, color spaces, geometric transformations, drawing, and basic filtering. These skills form the preprocessing layer for any vision-powered agent system.

## Learning Objectives

- [ ] Load, display, and save images and video streams with OpenCV.
- [ ] Convert between color spaces (BGR, RGB, Grayscale, HSV) and explain when to use each.
- [ ] Apply geometric transformations and basic filters (blur, threshold, edge detection).

## Lecture Guide

**Source:** OpenCV official documentation (docs.opencv.org) + free PyImageSearch guides

1. **Installing OpenCV** — pip install opencv-python and opencv-python-headless.
2. **Reading Images** — cv2.imread, understanding BGR vs. RGB.
3. **Displaying Images** — cv2.imshow and headless alternatives (matplotlib).
4. **Saving Images** — cv2.imwrite and format options.
5. **Color Spaces** — BGR, RGB, Grayscale, and HSV conversions.
6. **Image Properties** — Shape, size, dtype, and pixel access.
7. **Drawing** — Lines, rectangles, circles, and text overlays.
8. **Geometric Transformations** — Resize, rotate, translate, and affine transforms.
9. **Image Arithmetic** — Blending, masking, and bitwise operations.
10. **Smoothing & Blurring** — Gaussian, median, and bilateral filters.
11. **Thresholding** — Binary, adaptive, and Otsu thresholding.
12. **Edge Detection** — Sobel, Laplacian, and Canny edges.
13. **Contours** — Finding and drawing boundaries.
14. **Video Basics** — Reading from webcam and video files.
15. **Performance Tips** — NumPy vectorization and GPU acceleration.

## Demo Outline (10 min)

1. Load an image with OpenCV. Convert it to grayscale and HSV.
2. Apply Gaussian blur and Canny edge detection.
3. Find contours and draw bounding boxes around detected regions.
4. Save the annotated image.

## Challenge (5 min)

> **The Preprocessor:** Write a Python script that takes an image, converts it to grayscale, applies adaptive thresholding, finds contours, and draws red bounding boxes around every contour with an area > 1000 pixels. Save the result.

## Allternit Connection

- **Internal system:** Allternit's vision preprocessor uses OpenCV for every screen capture pipeline.
- **Reference repo/file:** OpenCV official docs: docs.opencv.org
- **Key difference from standard approach:** Allternit runs OpenCV operations on the CPU to minimize dependency complexity. Only heavy inference (e.g., YOLO) is offloaded to GPU if available.
