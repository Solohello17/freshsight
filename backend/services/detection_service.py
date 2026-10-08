"""
FreshSight — Detection and Freshness Service
==========================================
Loads the YOLOv8 detector and MobileNetV3 freshness classifier.
Evaluates 5 input images, selects the best one, runs the pipeline,
and outputs count results and base64-annotated image.
"""

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
from ultralytics import YOLO
import base64
from datetime import datetime
from collections import defaultdict
from config import DETECTOR_PATH, CLASSIFIER_PATH, YOLO_NAMES, CLASSIFIABLE_FRUITS, SHELF_LIFE, DETECTION_CONF, DEFAULT_ITEMS

# Preprocessing for the classification model
PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# Colors for bounding boxes (BGR)
FRESH_COLOR = (90, 220, 50)     # Green
ROTTEN_COLOR = (60, 60, 220)    # Red
BOX_COLORS = {
    "apple": (255, 200, 80),
    "banana": (255, 200, 0),
    "orange": (255, 140, 0),
}

# Display names
DISPLAY_NAMES = {
    "freshapples": "fresh apple",
    "freshbanana": "fresh banana",
    "freshoranges": "fresh orange",
    "rottenapples": "rotten apple",
    "rottenbanana": "rotten banana",
    "rottenoranges": "rotten orange",
}

class DetectionService:
    def __init__(self):
        self.detector = None
        self.clf_model = None
        self.class_names = []
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.loaded = False

    def load_models(self):
        """Loads both detector and freshness models once."""
        if self.loaded:
            return

        print(f"[DetectionService] Loading detector model from {DETECTOR_PATH} ...")
        self.detector = YOLO(str(DETECTOR_PATH))

        print(f"[DetectionService] Loading classifier model from {CLASSIFIER_PATH} ...")
        ckpt = torch.load(str(CLASSIFIER_PATH), map_location="cpu", weights_only=False)
        self.class_names = ckpt["class_names"]
        num_classes = ckpt["num_classes"]

        self.clf_model = models.mobilenet_v3_small(weights=None)
        in_features = self.clf_model.classifier[-1].in_features
        self.clf_model.classifier[-1] = nn.Linear(in_features, num_classes)
        self.clf_model.load_state_dict(ckpt["model_state_dict"])
        self.clf_model.eval()
        self.clf_model = self.clf_model.to(self.device)

        self.loaded = True
        print(f"[DetectionService] Models loaded successfully on {self.device}")

    def get_blur_score(self, gray):
        """Variance of Laplacian (higher is sharper)."""
        return cv2.Laplacian(gray, cv2.CV_64F).var()

    def get_brightness_score(self, gray):
        """Mean pixel intensity score (1.0 = ideal, lower = too dark/bright)."""
        mean = gray.mean()
        # Scale score: deviation from middle gray (127)
        return 1.0 - (abs(mean - 127) / 127.0)

    def select_best_image(self, images_bgr):
        """
        Evaluate and return the index of the best image from a list of BGR images
        based on blur score and brightness.
        """
        best_score = -1
        best_idx = 0
        scores_log = []

        for i, img in enumerate(images_bgr):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blur = self.get_blur_score(gray)
            bright = self.get_brightness_score(gray)

            # Combined score: sharp, well-lit image is best
            score = blur * bright
            scores_log.append(f"Image {i+1}: blur={blur:.2f}, brightness_factor={bright:.2f}, score={score:.2f}")

            if score > best_score:
                best_score = score
                best_idx = i

        print(f"[DetectionService] Image Selection Log:\n" + "\n".join(scores_log))
        print(f"[DetectionService] Selected Image {best_idx+1} as best quality.")
        return best_idx

    def classify_crop(self, crop_bgr):
        """Returns (class_name, confidence)."""
        if crop_bgr is None or crop_bgr.size == 0:
            return "unknown", 0.0
        try:
            pil_img = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
            tensor = PREPROCESS(pil_img).unsqueeze(0).to(self.device)
            with torch.no_grad():
                logits = self.clf_model(tensor)
                probs = torch.softmax(logits, dim=1)[0]
                idx = probs.argmax().item()
            return self.class_names[idx], float(probs[idx].item())
        except Exception as e:
            print(f"[DetectionService] Error classifying crop: {e}")
            return "unknown", 0.0

    def run_inference(self, image):
        """
        Runs object detection and crop classification.
        Draws annotations and returns results dictionary and base64-annotated image.
        """
        self.load_models()  # Ensure models are loaded
        h_img, w_img = image.shape[:2]

        # 1. Run YOLO detection
        results = self.detector.predict(image, conf=DETECTION_CONF, iou=0.45, verbose=False)[0]

        # Track counts per item type
        # Structure: {item_name: {count, fresh_count, rotten_count}}
        counts = defaultdict(lambda: {"count": 0, "fresh_count": 0, "rotten_count": 0})
        annotated_image = image.copy()

        for box in results.boxes:
            cls_id = int(box.cls[0])
            det_conf = float(box.conf[0])
            fruit_name = YOLO_NAMES[cls_id] if cls_id < len(YOLO_NAMES) else "unknown"

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w_img, x2), min(h_img, y2)

            crop = image[y1:y2, x1:x2]

            # Freshness classification for classifiable fruits
            if fruit_name in CLASSIFIABLE_FRUITS:
                fresh_class, clf_conf = self.classify_crop(crop)
                
                # Correct weak rotten detections
                if fresh_class.startswith("rotten") and clf_conf < 0.50:
                    fresh_class = fresh_class.replace("rotten", "fresh")

                is_fresh = fresh_class.startswith("fresh")
                box_color = FRESH_COLOR if is_fresh else ROTTEN_COLOR
                shelf = SHELF_LIFE.get(fresh_class, "")
                disp = DISPLAY_NAMES.get(fresh_class, fresh_class)
                label_main = f"{disp} {clf_conf*100:.0f}%"
                label_sub = shelf
                text_color = (220, 255, 220) if is_fresh else (220, 200, 255)

                # Update counts
                counts[fruit_name]["count"] += 1
                if is_fresh:
                    counts[fruit_name]["fresh_count"] += 1
                else:
                    counts[fruit_name]["rotten_count"] += 1
            else:
                # Fallback for any class without a freshness model
                box_color = BOX_COLORS.get(fruit_name, (200, 200, 200))
                label_main = f"{fruit_name} {det_conf*100:.0f}%"
                label_sub = "Detected"
                text_color = (255, 255, 255)

                counts[fruit_name]["count"] += 1
                # Standard items are counted as fresh
                counts[fruit_name]["fresh_count"] += 1

            # Bounding box
            cv2.rectangle(annotated_image, (x1, y1), (x2, y2), box_color, 2)

            # Label rendering
            font = cv2.FONT_HERSHEY_DUPLEX
            (lw, lh), bl = cv2.getTextSize(label_main, font, 0.48, 1)
            (sw, sh), _ = cv2.getTextSize(label_sub, font, 0.38, 1)
            box_top = max(y1 - lh - sh - 14, 0)
            bg_w = max(lw, sw) + 12

            # Background pill
            cv2.rectangle(annotated_image, (x1, box_top), (x1 + bg_w, y1), box_color, -1)
            # Texts
            cv2.putText(annotated_image, label_main, (x1 + 6, box_top + lh + 2), font, 0.48, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(annotated_image, label_sub, (x1 + 6, box_top + lh + sh + 8), font, 0.38, text_color, 1, cv2.LINE_AA)

        # Convert items dictionary to structured list
        items_list = []
        for name, item_counts in counts.items():
            items_list.append({
                "name": name,
                "count": item_counts["count"],
                "fresh_count": item_counts["fresh_count"],
                "rotten_count": item_counts["rotten_count"]
            })

        # Make sure all standard items are represented (even if 0 count) so frontend inventory table is populated
        for item in DEFAULT_ITEMS:
            if item not in counts:
                items_list.append({
                    "name": item,
                    "count": 0,
                    "fresh_count": 0,
                    "rotten_count": 0
                })

        # Encode annotated image as base64 JPEG
        _, buffer = cv2.imencode('.jpg', annotated_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            "scan_time": datetime.now().isoformat(),
            "items": items_list
        }, img_base64

# Singleton instance
detection_service = DetectionService()
