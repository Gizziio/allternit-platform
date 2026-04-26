# Scikit-Learn Patterns

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

This module covers the practical patterns for building ML models with scikit-learn: data loading, preprocessing, model selection, cross-validation, and serialization. You will learn to build reliable, reproducible ML pipelines that can be deployed as agent tools.

## Learning Objectives

- [ ] Build a complete scikit-learn pipeline from raw data to serialized model.
- [ ] Apply cross-validation and hyperparameter tuning systematically.
- [ ] Evaluate model performance with appropriate metrics for classification and regression.

## Lecture Guide

**Source:** Machine Learning Fundamentals [Python] + Machine Learning with Python

1. **Data Loading** — Pandas, CSVs, and train/test splits.
2. **Exploratory Analysis** — Understanding distributions and correlations.
3. **Preprocessing** — Scaling, encoding, and imputation.
4. **Pipeline API** — Chaining preprocessors and estimators.
5. **Model Selection** — When to use Linear Regression, Random Forest, or SVM.
6. **Classification Metrics** — Accuracy, precision, recall, F1, and ROC-AUC.
7. **Regression Metrics** — MAE, MSE, RMSE, and R².
8. **Cross-Validation** — K-fold stratification and time-series splits.
9. **Hyperparameter Tuning** — Grid search and randomized search.
10. **Feature Importance** — Understanding what drives predictions.
11. **Overfitting & Underfitting** — Bias-variance trade-off in practice.
12. **Model Serialization** — Saving and loading with joblib/pickle.
13. **Prediction APIs** — Wrapping models in functions for downstream use.
14. **Error Analysis** — Investigating misclassified examples.
15. **Reproducibility** — Random seeds, version pinning, and experiment tracking.

## Demo Outline (10 min)

1. Load a dataset (e.g., Iris or California housing).
2. Build a Pipeline with StandardScaler + RandomForest.
3. Run cross-validation, tune one hyperparameter, and evaluate on the test set.
4. Serialize the best model.

## Challenge (5 min)

> **The Agent-Ready Model:** Train a scikit-learn classifier on a public dataset. Achieve >80% accuracy. Save it as a .joblib file. Write a Python function load_model(path) → model that returns predictions given a dictionary input.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts several scikit-learn models for numerical reasoning tasks.
- **Reference repo/file:** \"models/sklearn_churn_v2.joblib\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit requires every model to include a metadata manifest documenting training data, feature schema, and performance metrics. No model is deployed without this manifest.
