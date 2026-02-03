"""
export_model.py — Export ResNet18 ReID backbone to ONNX.

main.py auto-exports on startup so this is optional (CI / offline use).

Usage:
    python export_model.py [--output models/reid_resnet18.onnx]
"""
import os, argparse, torch
import torchvision.models as models

DEFAULT_OUTPUT = "models/reid_resnet18.onnx"

def export(output_path: str = DEFAULT_OUTPUT) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    backbone          = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    feature_extractor = torch.nn.Sequential(*list(backbone.children())[:-1])
    feature_extractor.eval()
    torch.onnx.export(
        feature_extractor, torch.randn(1, 3, 256, 128), output_path,
        export_params=True, opset_version=12,
        input_names=["input"], output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
    )
    print(f"Exported → {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    export(parser.parse_args().output)
