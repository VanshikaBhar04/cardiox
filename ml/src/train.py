import os
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score


# Loading and cleaning the dataset
DATA_PATH = "data/heart_disease_uci.csv"
df = pd.read_csv(DATA_PATH)

df = df.drop(columns=["id", "dataset"])
df["target"] = (df["num"] > 0).astype(int)
df = df.drop(columns=["num"])

X = df.drop(columns=["target"])
y = df["target"]

# The list of features from the dataset

numerical_features = ["age", "trestbps", "chol", "thalch", "oldpeak", "ca"]
categorical_features = ["sex", "cp", "fbs", "restecg", "exang", "slope", "thal"]

# Preprocessoring step

numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler())
])

categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore"))
])

preprocessor = ColumnTransformer([
    ("num", numeric_pipeline, numerical_features),
    ("cat", categorical_pipeline, categorical_features)
])

# Splitting data into training and testing
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Training the models for comparison
log_reg = Pipeline([
    ("preprocessor", preprocessor),
    ("model", LogisticRegression(max_iter=2000))
])

rf = Pipeline([
    ("preprocessor", preprocessor),
    ("model", RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced"
    ))
])

log_reg.fit(X_train, y_train)
rf.fit(X_train, y_train)

log_probs = log_reg.predict_proba(X_test)[:, 1]
rf_probs = rf.predict_proba(X_test)[:, 1]

log_auc = roc_auc_score(y_test, log_probs)
rf_auc = roc_auc_score(y_test, rf_probs)

print("\n=== Final Comparison (ROC-AUC) ===")
print("Logistic Regression:", round(log_auc, 4))
print("Random Forest:", round(rf_auc, 4))

# Selecting the final based on the highest AUC

final_model = rf if rf_auc >= log_auc else log_reg
final_name = "random_forest" if rf_auc >= log_auc else "logistic_regression"

print("\nSelected final model:", final_name)
print(f"Example risk: {final_model.predict_proba(X_test.iloc[[0]])[:,1][0]*100:.2f}%")

# Saving the artifacts

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
