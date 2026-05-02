#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--labels", default="")
    parser.add_argument("--top", type=int, default=3)
    return parser.parse_args()


def load_labels(path):
    if not path:
        return []
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as handle:
        return [line.strip() for line in handle if line.strip()]


def softmax(values):
    values = np.asarray(values, dtype=np.float32)
    values = values - np.max(values)
    exp = np.exp(values)
    total = np.sum(exp)
    if total == 0:
        return np.zeros_like(values)
    return exp / total


def normalize_scores(scores):
    scores = np.asarray(scores, dtype=np.float32).reshape(-1)
    if np.any(np.isnan(scores)):
        scores = np.nan_to_num(scores)
    total = float(np.sum(scores))
    if total <= 0 or total > 1.5 or float(np.max(scores)) > 1.0:
        scores = softmax(scores)
    return scores


def prepare_image(image_path, target_size):
    image = Image.open(image_path).convert("RGB")
    image = image.resize((target_size[1], target_size[0]))
    return np.asarray(image)


def load_tflite_interpreter(model_path):
    try:
        import tflite_runtime.interpreter as tflite
        return tflite.Interpreter(model_path=model_path)
    except Exception:
        pass

    try:
        import tensorflow as tf
        return tf.lite.Interpreter(model_path=model_path)
    except Exception as exc:
        raise RuntimeError(
            "TensorFlow or tflite_runtime is required for .tflite models"
        ) from exc


def run_tflite(model_path, image_path):
    interpreter = load_tflite_interpreter(model_path)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    shape = input_details.get("shape", [])
    height = int(shape[1]) if len(shape) > 2 else 224
    width = int(shape[2]) if len(shape) > 2 else 224
    image = prepare_image(image_path, (height, width))
    input_dtype = input_details.get("dtype", np.float32)

    if input_dtype == np.float32:
        tensor = image.astype(np.float32) / 255.0
    else:
        tensor = image.astype(input_dtype)

    tensor = np.expand_dims(tensor, axis=0)
    interpreter.set_tensor(input_details["index"], tensor)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"])
    return output[0]


def run_keras(model_path, image_path):
    try:
        import tensorflow as tf
    except Exception as exc:
        raise RuntimeError(
            "TensorFlow is required for .h5/.keras models"
        ) from exc

    model = tf.keras.models.load_model(model_path)
    input_shape = model.input_shape or [None, 224, 224, 3]
    height = int(input_shape[1] or 224)
    width = int(input_shape[2] or 224)
    image = prepare_image(image_path, (height, width))
    tensor = image.astype(np.float32) / 255.0
    tensor = np.expand_dims(tensor, axis=0)
    output = model.predict(tensor, verbose=0)
    return output[0]


def predict(model_path, image_path):
    ext = os.path.splitext(model_path)[1].lower()
    if ext == ".tflite":
        return run_tflite(model_path, image_path)
    return run_keras(model_path, image_path)


def build_result(scores, labels, top):
    if len(labels) < len(scores):
        labels = labels + [
            f"class_{idx}"
            for idx in range(len(labels), len(scores))
        ]

    top = max(1, int(top))
    indices = np.argsort(scores)[::-1][:top]
    topk = [
        {
            "label": labels[idx],
            "confidence": float(scores[idx]),
        }
        for idx in indices
    ]

    return {
        "label": topk[0]["label"],
        "confidence": float(topk[0]["confidence"]),
        "topK": topk,
        "classes": len(scores),
    }


def main():
    args = parse_args()

    if not os.path.exists(args.image):
        raise FileNotFoundError(f"Image not found: {args.image}")
    if not os.path.exists(args.model):
        raise FileNotFoundError(f"Model not found: {args.model}")

    start = time.time()
    scores = predict(args.model, args.image)
    scores = normalize_scores(scores)
    labels = load_labels(args.labels)
    result = build_result(scores, labels, args.top)
    result["model"] = os.path.basename(args.model)
    result["inferenceMs"] = int((time.time() - start) * 1000)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.stderr.write(str(exc))
        sys.exit(1)
