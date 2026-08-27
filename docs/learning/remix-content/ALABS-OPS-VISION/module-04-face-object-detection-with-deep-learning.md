# Face & Object Detection with Deep Learning

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

Classical computer vision is fast and interpretable, but deep learning excels at complex detection tasks. This module introduces pre-trained neural networks for face and object detection: Haar cascades, HOG+SVM, and modern detectors like YOLO and MediaPipe. You will learn when to use classical methods, when to use deep learning, and how to run detectors locally.

## Learning Objectives

- [ ] Detect faces in images using Haar cascades and DNN-based methods.
[ ] Run a pre-trained YOLO model locally for general object detection.
[ ] Compare classical CV speed vs. deep learning accuracy for agent use cases.

## Lecture Guide

**Source:** OpenCV DNN module docs + YOLO documentation + MediaPipe docs

1. **Face Detection History** — From Viola-Jones to deep neural nets.
2. **Haar Cascades** — Fast, lightweight face detection in OpenCV.
3. **HOG + SVM** — Histogram of Oriented Gradients for pedestrian detection.
4. **DNN Face Detectors** — OpenCV's face_detector model (Caffe/TensorFlow).
5. **MediaPipe** — Google's lightweight face and hand tracking.
6. **Object Detection Basics** — Bounding boxes, confidence scores, and NMS.
7. **YOLO Family** — YOLOv5, v8, and v9 for real-time detection.
8. **Running YOLO with OpenCV** — Loading Darknet/ONNX models in cv2.dnn.
9. **Label Parsing** — Mapping class IDs to human-readable names.
10. **Non-Max Suppression** — Filtering overlapping detections.
11. **Performance Optimization** — Quantization and inference engines.
12. **Custom Classes** — Fine-tuning detectors on domain-specific data.
13. **Tracking + Detection** — Combining YOLO with SORT/DeepSORT trackers.
14. **Ethical Considerations** — Privacy, bias, and consent in face detection.
15. **Agent Integration** — Feeding detection results into LLM prompts.

## Demo Outline (10 min)

1. Run OpenCV's DNN face detector on a webcam feed. Draw bounding boxes and confidence scores.
2. Switch to a local YOLO model. Detect common objects (chair, phone, person).
3. Compare frames-per-second between the Haar cascade and the DNN detector.

## Challenge (5 min)

> **The Object Counter:** Write a script that uses a local YOLO or MobileNet model to detect and count the number of people in a video file. Output the count per frame and the total unique appearances.

## Allternit Connection

- **Internal system:** Allternit's GUI automation uses lightweight object detection to identify buttons and form fields.
- **Reference repo/file:** OpenCV DNN module examples.
- **Key difference from standard approach:** Allternit runs all vision models locally. No video frames or screenshots are sent to cloud vision APIs for detection tasks.
