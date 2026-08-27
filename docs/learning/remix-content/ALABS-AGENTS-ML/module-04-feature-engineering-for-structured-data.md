# Feature Engineering for Structured Data

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

Feature engineering is the difference between a mediocre model and a production-grade one. This module covers how to transform raw structured data into features that ML models can exploit: encoding categoricals, creating interactions, handling missing values, and reducing dimensionality.

## Learning Objectives

- [ ] Engineer features from dates, categories, and numerical columns.
- [ ] Handle missing data with imputation strategies that preserve signal.
- [ ] Select the most predictive features using statistical and model-based methods.

## Lecture Guide

**Source:** Machine Learning with Python + scikit-learn documentation

1. **Feature Types** — Numerical, categorical, ordinal, and datetime.
2. **Scaling** — StandardScaler, MinMaxScaler, and when to use each.
3. **Encoding Categories** — One-hot, ordinal, target, and frequency encoding.
4. **Datetime Features** — Extracting day, month, hour, and elapsed time.
5. **Interaction Features** — Polynomials, ratios, and domain-specific combinations.
6. **Binning** — Converting continuous variables into discrete buckets.
7. **Missing Value Imputation** — Mean, median, mode, and model-based imputation.
8. **Indicator Variables** — Tracking which values were originally missing.
9. **Outlier Handling** — Clipping, transformation, and robust scaling.
10. **Feature Selection** — Filter methods, wrapper methods, and embedded methods.
11. **Dimensionality Reduction** — PCA and feature aggregation.
12. **Text as Features** — TF-IDF and count vectors for categorical text.
13. **Pipeline Integration** — Embedding feature engineering in scikit-learn pipelines.
14. **Feature Drift** — Monitoring feature distributions in production.
15. **Domain Knowledge** — Leveraging business rules to create powerful features.

## Demo Outline (10 min)

1. Take a raw dataset with mixed types.
2. Build a ColumnTransformer that scales numerics, one-hot encodes categoricals, and extracts date features.
3. Show how feature engineering improves cross-validation scores compared to raw data.

## Challenge (5 min)

> **The Feature Pipeline:** Starting from a messy CSV with missing values and mixed types, build a scikit-learn Pipeline that handles all preprocessing automatically. Train a model and show that it works on a held-out test row without manual preprocessing.

## Allternit Connection

- **Internal system:** Allternit's ML pipeline uses a feature store to ensure training and inference schemas match.
- **Reference repo/file:** \"services/feature-store/schema_registry.py\"
- **Key difference from standard approach:** Allternit freezes feature engineering logic at model training time. The exact same ColumnTransformer is bundled with the model artifact to prevent training-serving skew.
