from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ----------------------
# 📦 LOAD MODEL
# ----------------------
model = joblib.load("model/final_model.pkl")

# ----------------------
# 📊 LOAD DATASET
# ----------------------
df = pd.read_excel("ds.xlsx")

# ----------------------
# 📍 FIND NEAREST AREA
# ----------------------
def get_nearest_area(lat, lon):
    try:
        df["distance"] = np.sqrt(
            (df["Latitude"] - lat) ** 2 +
            (df["Longitude"] - lon) ** 2
        )

        nearest = df.loc[df["distance"].idxmin()]
        return nearest.copy()   # ✅ avoid modifying original

    except Exception as e:
        print("Error in nearest area:", e)
        return None


# ----------------------
# 🧠 PREDICT API
# ----------------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json

        if not data:
            return jsonify({"error": "No input data"}), 400

        lat = data.get("Latitude")
        lon = data.get("Longitude")

        if lat is None or lon is None:
            return jsonify({"error": "Latitude and Longitude required"}), 400

        lat = float(lat)
        lon = float(lon)

        # 🔥 Get nearest area
        area = get_nearest_area(lat, lon)

        if area is None:
            return jsonify({"error": "Area not found"}), 400

        # ----------------------
        # 📊 FEATURE EXTRACTION
        # ----------------------
        area['Risk_Density'] = area['Crime_Index'] * area['Crowd_Density']
        area['Safety_Inverse'] = 1 / (area['Police_Distance_km'] + 1)

        features = [[
            area["Crime_Index"],
            area["Crowd_Density"],
            area["Lighting_Score"],
            area["Road_Quality"],
            area["Police_Distance_km"],
            area["Updated_Crime_Rate"],
            area["Safety_Inverse"],
            area["Crowd_Density"]
        ]]

        # ----------------------
        # 🤖 PREDICT
        # ----------------------
        risk = model.predict(features)[0]

        return jsonify({
            "risk": float(risk),
            "area": area["Area"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------------------
# 🔥 HEATMAP API
# ----------------------
@app.route("/heatmap", methods=["GET"])
def heatmap():
    try:
        heat_data = []

        for _, row in df.iterrows():
            heat_data.append({
                "lat": float(row["Latitude"]),
                "lon": float(row["Longitude"]),
                "intensity": float(row["Crime_Index"]) / 100
            })

        return jsonify(heat_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------------------
# 🧪 TEST ROUTE
# ----------------------
@app.route("/")
def home():
    return "Safe Route API Running 🚀"


# ----------------------
# ▶️ RUN SERVER (FOR LOCAL ONLY)
# ----------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)