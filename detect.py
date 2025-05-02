from ultralytics import YOLO
import cv2
img = cv2.imread("test1.jpg")
print(img.shape)  # Print the shape of the image
model = YOLO('best.pt')
results = model("test1.jpg",imgsz = 1280)  # Predict on an image
result = results[0]
result.show()  # Show the result image with bounding boxes