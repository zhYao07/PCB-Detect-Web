import numpy as np
from PIL import Image
import cv2
import io
from ultralytics import YOLO
import torch
from copy import deepcopy

def iou(box1, box2):
    """Calculate IoU between two boxes"""
    x1_min, y1_min, x1_max, y1_max = box1[:4]
    x2_min, y2_min, x2_max, y2_max = box2[:4]

    inter_xmin = max(x1_min, x2_min)
    inter_ymin = max(y1_min, y2_min)
    inter_xmax = min(x1_max, x2_max)
    inter_ymax = min(y1_max, y2_max)

    inter_width = max(0, inter_xmax - inter_xmin)
    inter_height = max(0, inter_ymax - inter_ymin)
    inter_area = inter_width * inter_height

    box1_area = (x1_max - x1_min) * (y1_max - y1_min)
    box2_area = (x2_max - x2_min) * (y2_max - y2_min)

    union_area = box1_area + box2_area - inter_area

    if union_area == 0:
        return 0

    return inter_area / union_area


def aggregate_boxes(predictions, iou_threshold=0.5):
    """Group similar boxes together"""
    # Create a deep copy to avoid modifying the original list
    predictions_copy = deepcopy(predictions)
    aggregated_boxes = []
    
    while predictions_copy:
        base_box = predictions_copy.pop(0)
        similar_boxes = [base_box]

        i = 0
        while i < len(predictions_copy):
            if iou(base_box, predictions_copy[i]) > iou_threshold:
                similar_boxes.append(predictions_copy[i])
                predictions_copy.pop(i)
            else:
                i += 1

        aggregated_boxes.append(similar_boxes)

    return aggregated_boxes


def voting_mechanism(aggregated_boxes, vote_threshold=3):
    """Apply voting to grouped boxes"""
    final_boxes = []
    for group in aggregated_boxes:
        if len(group) >= vote_threshold:
            # Average the box coordinates and confidence
            avg_box = [sum(box[i] for box in group) / len(group) for i in range(4)]
            avg_conf = sum(box[4] for box in group) / len(group)
            cls = group[0][5]  # Use the class from the first box
            final_boxes.append(avg_box + [avg_conf, cls])
    return final_boxes


class YOLOv11Ensemble:
    def __init__(self, model_path, conf_thres=0.4, iou_thres=0.45, device=None, imgsz=600):
        """Initialize the YOLOv11 ensemble detector"""
        # 自动检测设备
        if device is None:
            self.device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        else:
            self.device = device
            
        print(f"Using device: {self.device}")
        
        # 载入模型并发送到指定设备
        self.model = YOLO(model_path)
        
        # 确保模型在正确的设备上
        if 'cuda' in self.device and torch.cuda.is_available():
            self.model.to(self.device)
        
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres
        self.imgsz = imgsz
        
    def predict(self, image_path, vote_threshold=3, orientation_count=4):
        """
        Run predictions with multi-orientation voting
        
        Args:
            image_path: Path to the image
            vote_threshold: Minimum votes required to keep a detection
            orientation_count: Number of orientations to use (1, 2, or 4)
                - 1: Only use original orientation
                - 2: Use original and 90° counter-clockwise
                - 4: Use all four orientations (0°, 90°, 180°, 270°)
        """
        # Validate orientation_count
        if orientation_count not in [1, 2, 4]:
            raise ValueError("orientation_count must be 1, 2, or 4")
            
        # If orientation_count is 2, adjust vote_threshold to at least 1
        if orientation_count == 2 and vote_threshold > 2:
            print(f"Warning: orientation_count=2 but vote_threshold={vote_threshold}. "
                  f"Adjusting vote_threshold to 1.")
            vote_threshold = 1
        
        # Load the original image
        original_image = Image.open(image_path)
        orig_img = np.array(original_image)
        orig_size = original_image.size  # (width, height)
        
        # Get original prediction (使用设备参数和imgsz参数)
        original_results = self.model(image_path, conf=self.conf_thres, iou=self.iou_thres, device=self.device, imgsz=self.imgsz)
        original_result = original_results[0]  # Store for later use
        
        # If orientation_count is 1, we still want to show prediction details
        if orientation_count == 1:
            print("Using only original orientation (no ensemble)")
            # Get and print boxes from original result
            pred0 = self._get_boxes_from_results(original_results[0])
            print("--- Original Orientation (0°) Predictions ---")
            for box in pred0:
                print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
            
            # Print final result info
            print("\n--- Final Boxes (Single Orientation) ---")
            for box in pred0:
                print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
                
            return original_result
            
        # Get predictions for all orientations
        all_predictions = []
        
        # 1. Original orientation (0 degrees)
        pred0 = self._get_boxes_from_results(original_results[0])
        print("--- Original Orientation (0°) Predictions ---")
        for box in pred0:
            print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
        all_predictions.extend(pred0)
        
        # 2. Rotate 90 degrees counter-clockwise
        rotated90 = original_image.rotate(90, expand=True)
        with io.BytesIO() as buffer:
            rotated90.save(buffer, format='JPEG')
            buffer.seek(0)
            # 使用设备参数和imgsz参数
            results90 = self.model(np.array(rotated90), conf=self.conf_thres, iou=self.iou_thres, device=self.device, imgsz=self.imgsz)
        
        # Transform coordinates back to original orientation
        w, h = orig_size[1], orig_size[0]  # swapped for 90 degrees
        pred90 = self._get_boxes_from_results(results90[0])
        transformed90 = []
        for box in pred90:
            # Transform coordinates back to original orientation
            transformed90.append([h-box[3], box[0], h-box[1], box[2], box[4], box[5]])
        print("--- 90° Counter-Clockwise Rotation Predictions (transformed to original) ---")
        for box in transformed90:
            print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
        all_predictions.extend(transformed90)
        
        # If orientation_count is 2, skip the remaining orientations
        if orientation_count == 2:
            print("Using only original and 90° counter-clockwise orientations")
        else:
            # 3. Rotate 180 degrees
            rotated180 = original_image.rotate(180, expand=True)
            with io.BytesIO() as buffer:
                rotated180.save(buffer, format='JPEG')
                buffer.seek(0)
                # 使用设备参数和imgsz参数
                results180 = self.model(np.array(rotated180), conf=self.conf_thres, iou=self.iou_thres, device=self.device, imgsz=self.imgsz)
                
            # Transform coordinates back to original orientation
            w, h = orig_size[0], orig_size[1]  # same as original for 180 degrees
            pred180 = self._get_boxes_from_results(results180[0])
            transformed180 = []
            for box in pred180:
                # Transform coordinates: (w-x2, h-y2, w-x1, h-y1)
                transformed180.append([w-box[2], h-box[3], w-box[0], h-box[1], box[4], box[5]])
            print("--- 180° Rotation Predictions (transformed to original) ---")
            for box in transformed180:
                print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
            all_predictions.extend(transformed180)
            
            # 4. Rotate 270 degrees (90 degrees clockwise)
            rotated270 = original_image.rotate(-90, expand=True)
            with io.BytesIO() as buffer:
                rotated270.save(buffer, format='JPEG')
                buffer.seek(0)
                # 使用设备参数和imgsz参数
                results270 = self.model(np.array(rotated270), conf=self.conf_thres, iou=self.iou_thres, device=self.device, imgsz=self.imgsz)
                
            # Transform coordinates back to original orientation
            w, h = orig_size[1], orig_size[0]  # swapped for 270 degrees
            pred270 = self._get_boxes_from_results(results270[0])
            transformed270 = []
            for box in pred270:
                # Transform coordinates: (h-y2, x1, h-y1, x2)
                transformed270.append([box[1], h-box[2], box[3], h-box[0], box[4], box[5]])
            print("--- 270° Rotation (90° Clockwise) Predictions (transformed to original) ---")
            for box in transformed270:
                print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
            all_predictions.extend(transformed270)
        
        # Aggregate and vote
        aggregated_boxes = aggregate_boxes(all_predictions, iou_threshold=self.iou_thres)
        
        # Print aggregated boxes
        print("\n--- Aggregated Box Groups ---")
        for i, group in enumerate(aggregated_boxes):
            print(f"Group {i+1}: {len(group)} boxes")
            for box in group:
                print(f"  Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
        
        final_boxes = voting_mechanism(aggregated_boxes, vote_threshold=vote_threshold)
        
        # Print final voted boxes
        print("\n--- Final Voted Boxes ---")
        for box in final_boxes:
            print(f"Class: {int(box[5])}, Coords: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}], Conf: {box[4]:.3f}")
        
        # Create a new result with the same structure as the original
        final_result = deepcopy(original_result)
        
        # Update the boxes properly to maintain compatibility with app.py
        if final_boxes and hasattr(final_result, 'boxes'):
            # Get the device from the original boxes
            device = final_result.boxes.data.device if hasattr(final_result.boxes, 'data') else self.device
            
            # Create tensor data for new boxes
            boxes_data = torch.zeros((len(final_boxes), 6), device=device)
            for i, box in enumerate(final_boxes):
                boxes_data[i, 0] = box[0]  # x1
                boxes_data[i, 1] = box[1]  # y1
                boxes_data[i, 2] = box[2]  # x2
                boxes_data[i, 3] = box[3]  # y2
                boxes_data[i, 4] = box[4]  # conf
                boxes_data[i, 5] = box[5]  # cls
            
            # Replace the boxes with compatible objects
            from ultralytics.engine.results import Boxes
            final_result.boxes = Boxes(boxes_data, final_result.orig_shape)
        
        return final_result
    
    def _get_boxes_from_results(self, result):
        """Extract bounding boxes from YOLOv11 result object"""
        boxes = []
        if hasattr(result, 'boxes') and len(result.boxes) > 0:
            # Get the tensor data
            boxes_data = result.boxes.data
            
            # Convert to list of [x1, y1, x2, y2, conf, cls]
            for box in boxes_data:
                boxes.append([
                    box[0].item(),  # x1
                    box[1].item(),  # y1
                    box[2].item(),  # x2
                    box[3].item(),  # y2
                    box[4].item(),  # conf
                    box[5].item()   # cls
                ])
        
        return boxes


# Example usage
if __name__ == "__main__":
    # 检测并打印可用设备信息
    if torch.cuda.is_available():
        print(f"CUDA available. Found {torch.cuda.device_count()} GPU(s)")
        for i in range(torch.cuda.device_count()):
            print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
    else:
        print("CUDA not available. Using CPU")
    
    # Initialize the model with automatic device selection and default imgsz
    model = YOLOv11Ensemble('best.pt', conf_thres=0.4, iou_thres=0.45, imgsz=600)
    
    # Examples of different orientation counts:
    print("\n=== USING ORIGINAL ORIENTATION ONLY (orientation_count=1) ===\n")
    result1 = model.predict("001.jpg", orientation_count=4, vote_threshold=2)
    
    # 其他测试用例保持不变
    # print("\n=== USING ORIGINAL AND 90° ROTATION (orientation_count=2) ===\n")
    # result2 = model.predict("example.jpg", vote_threshold=1, orientation_count=2)
    
    # print("\n=== USING ALL FOUR ORIENTATIONS (orientation_count=4) ===\n")
    # result4 = model.predict("example.jpg", vote_threshold=2, orientation_count=4)