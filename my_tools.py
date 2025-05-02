def iou(box1, box2):
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
    aggregated_boxes = []
    while predictions:
        base_box = predictions.pop(0)
        similar_boxes = [base_box]

        for box in predictions[:]:
            if iou(base_box, box) > iou_threshold:
                similar_boxes.append(box)
                predictions.remove(box)

        aggregated_boxes.append(similar_boxes)

    return aggregated_boxes


def voting_mechanism(aggregated_boxes, vote_threshold=3):
    final_boxes = []
    for group in aggregated_boxes:
        if len(group) >= vote_threshold:
            avg_box = [sum(box[i] for box in group) / len(group) for i in range(4)]
            avg_conf = sum(box[4] for box in group) / len(group)
        #   max_conf = max(box[4] for box in group)
            cls = group[0][5]
            final_boxes.append(avg_box + [avg_conf, cls])
    return final_boxes