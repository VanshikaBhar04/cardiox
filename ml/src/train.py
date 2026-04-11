# --------------------------------------------------
# CardioX Model Training Pipeline
# --------------------------------------------------

# Trains candidate machine learning models for cardiovascular
# risk prediction, compares performance using ROC-AUC,
# selects the best-performing model, and saves the final artifacts.

import os

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# --------------------------------------------------
# Dataset Loading and Preparation
# --------------------------------------------------

DATA_PATH = "data/heart_disease_uci.csv"
df = pd.read_csv(DATA_PATH)

# Remove unused source-identifying fields from the original dataset
df = df.drop(columns=["id", "dataset"])

# Convert the original multi-class heart disease column into
# a binary target for presence or absence of disease
df["target"] = (df["num"] > 0).astype(int)
df = df.drop(columns=["num"])

X = df.drop(columns=["target"])
y = df["target"]


# --------------------------------------------------
# Feature Definitions
# --------------------------------------------------

# Numerical and categorical feature groups are separated
# so appropriate preprocessing can be applied to each type
numerical_features = ["age", "trestbps", "chol", "thalch", "oldpeak", "ca"]
categorical_features = ["sex", "cp", "fbs", "restecg", "exang", "slope", "thal"]


# --------------------------------------------------
# Preprocessing Pipelines
# --------------------------------------------------

# Numerical features are imputed using the median and scaled
# to support stable model training
numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

# Categorical features are imputed using the most frequent value
# and one-hot encoded for model compatibility
categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore")),
])

# Combines numerical and categorical preprocessing into one reusable step
preprocessor = ColumnTransformer([
    ("num", numeric_pipeline, numerical_features),
    ("cat", categorical_pipeline, categorical_features),
])


# --------------------------------------------------
# Train / Test Split
# --------------------------------------------------

# Stratified splitting preserves the class balance between
# training and test sets for a fair evaluation
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)


# --------------------------------------------------
# Candidate Model Definitions
# --------------------------------------------------

# Logistic Regression provides a simpler baseline model
log_reg = Pipeline([
    ("preprocessor", preprocessor),
    ("model", LogisticRegression(max_iter=2000)),
])

# Random Forest provides a more flexible ensemble model
rf = Pipeline([
    ("preprocessor", preprocessor),
    ("model", RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced",
    )),
])


# --------------------------------------------------
# Model Training
# --------------------------------------------------

log_reg.fit(X_train, y_train)
rf.fit(X_train, y_train)


# --------------------------------------------------
# Model Evaluation
# --------------------------------------------------

# Predicted probabilities are used to compare the models
# with ROC-AUC rather than simple accuracy
log_probs = log_reg.predict_proba(X_test)[:, 1]
rf_probs = rf.predict_proba(X_test)[:, 1]

log_auc = roc_auc_score(y_test, log_probs)
rf_auc = roc_auc_score(y_test, rf_probs)

print("\n=== Final Comparison (ROC-AUC) ===")
print("Logistic Regression:", round(log_auc, 4))
print("Random Forest:", round(rf_auc, 4))


# --------------------------------------------------
# Final Model Selection
# --------------------------------------------------

# Selects the best-performing model based on ROC-AUC
final_model = rf if rf_auc >= log_auc else log_reg
final_name = "random_forest" if rf_auc >= log_auc else "logistic_regression"

print("\nSelected final model:", final_name)
print(f"Example risk: {final_model.predict_proba(X_test.iloc[[0]])[:, 1][0] * 100:.2f}%")


# --------------------------------------------------
# Artifact Saving
# --------------------------------------------------

# Saves the selected model and a summary of evaluation results
os.makedirs("artifacts", exist_ok=True)

joblib.dump(final_model, "artifacts/final_model.joblib")

with open("artifacts/model_metrics.txt", "w") as f:
    f.write("CardioX - Model Metrics\n")
    f.write(f"Logistic Regression ROC-AUC: {log_auc:.4f}\n")
    f.write(f"Random Forest ROC-AUC: {rf_auc:.4f}\n")
    f.write(f"Selected final model: {final_name}\n")

print("\nSaved artifacts:")
print("- artifacts/final_model.joblib")
print("- artifacts/model_metrics.txt")