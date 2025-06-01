import joblib
from flask import Flask, request, jsonify
from sklearn.linear_model import LogisticRegression


app = Flask(__name__)
# model = joblib.load("model.pkl")  # 载入预训练模型
model = LogisticRegression()

@app.route("/predict", methods=["POST"])
def predict_risk():
    fhir_data = request.json
    features = extract_features(fhir_data)  # 你自己定义
    risk_score = model.predict_proba([features])[0, 1]
    return jsonify({"risk_score": risk_score})

def extract_features(fhir_data):
    # 这里需要实现从FHIR数据中提取特征的逻辑
    # 返回一个特征向量
    return [0] * 10  # 示例：返回一个长度为10的零向量
def predict_risk():
    fhir_data = request.json
    features = extract_features(fhir_data)  # 你自己定义
    risk_score = model.predict_proba([features])[0, 1]
    return jsonify({"risk_score": risk_score})