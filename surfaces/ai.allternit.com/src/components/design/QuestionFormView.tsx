"use client";

import { useState } from "react";
import {
  QuestionForm,
  FormQuestion,
  DirectionCard,
  formatFormAnswers,
} from "../../lib/openui/question-form-parser";

interface Props {
  form: QuestionForm;
  onSubmit: (text: string) => void;
}

interface CardProps {
  card: DirectionCard;
  selected: boolean;
  onClick: () => void;
}

function DirectionCardItem({ card, selected, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "var(--accent-primary, #6366f1)1a" : "var(--surface-panel, rgba(255,255,255,0.04))",
        border: `1px solid ${selected ? "var(--accent-primary, #6366f1)" : "var(--border-default, rgba(255,255,255,0.1))"}`,
        borderRadius: "8px",
        padding: "12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        {card.palette.slice(0, 5).map((hex, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: hex,
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-primary, #e8e0d8)",
          marginBottom: "2px",
          fontFamily: card.font,
        }}
      >
        {card.label}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary, rgba(255,255,255,0.5))", lineHeight: 1.4 }}>
        {card.mood}
      </div>
      {card.references.length > 0 && (
        <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--text-secondary, rgba(255,255,255,0.4))", opacity: 0.7 }}>
          Refs: {card.references.slice(0, 3).join(", ")}
        </div>
      )}
    </button>
  );
}

interface QuestionFieldProps {
  question: FormQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}

function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  const strVal = Array.isArray(value) ? '' : value;
  const arrVal = Array.isArray(value) ? value : [];

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-primary, #e8e0d8)",
    marginBottom: "4px",
  };
  const descStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--text-secondary, rgba(255,255,255,0.5))",
    marginBottom: "8px",
    lineHeight: 1.4,
  };
  const inputStyle: React.CSSProperties = {
    background: "var(--surface-panel, rgba(255,255,255,0.04))",
    border: "1px solid var(--border-default, rgba(255,255,255,0.1))",
    borderRadius: "6px",
    padding: "8px 10px",
    color: "var(--text-primary, #e8e0d8)",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
  };

  switch (question.type) {
    case 'radio':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={strVal === opt.value}
                  onChange={() => onChange(opt.value)}
                  style={{ marginTop: "2px", accentColor: "var(--accent-primary, #6366f1)", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary, #e8e0d8)" }}>{opt.label}</div>
                  {opt.description && (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary, rgba(255,255,255,0.5))", marginTop: "1px" }}>
                      {opt.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={arrVal.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arrVal, opt.value]
                      : arrVal.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                  style={{ marginTop: "2px", accentColor: "var(--accent-primary, #6366f1)", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary, #e8e0d8)" }}>{opt.label}</div>
                  {opt.description && (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary, rgba(255,255,255,0.5))", marginTop: "1px" }}>
                      {opt.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      );

    case 'select':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <select
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, appearance: "none" }}
          >
            <option value="">Select…</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'text':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <input
            type="text"
            value={strVal}
            placeholder={question.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <textarea
            value={strVal}
            placeholder={question.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      );

    case 'direction-cards':
      return (
        <div>
          <div style={labelStyle}>{question.label}{question.required && ' *'}</div>
          {question.description && <div style={descStyle}>{question.description}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
            {(question.cards ?? []).map((card) => (
              <DirectionCardItem
                key={card.id}
                card={card}
                selected={strVal === card.id}
                onClick={() => onChange(card.id)}
              />
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function QuestionFormView({ form, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const text = formatFormAnswers(form, answers);
    onSubmit(text);
    setSubmitted(true);
  }

  const allRequired = form.questions
    .filter((q) => q.required)
    .every((q) => {
      const v = answers[q.id];
      return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
    });

  if (submitted) {
    return (
      <div
        style={{
          background: "var(--surface-panel, rgba(255,255,255,0.04))",
          border: "1px solid var(--border-default, rgba(255,255,255,0.1))",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "var(--text-secondary, rgba(255,255,255,0.5))",
        }}
      >
        <span style={{ color: "var(--accent-primary, #6366f1)", fontWeight: 600 }}>✓ Answered</span>
        {form.title && <span>— {form.title}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface-panel, rgba(255,255,255,0.04))",
        border: "1px solid var(--border-default, rgba(255,255,255,0.1))",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      {form.title && (
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary, #e8e0d8)",
            marginBottom: "4px",
          }}
        >
          {form.title}
        </div>
      )}
      {form.description && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-secondary, rgba(255,255,255,0.5))",
            marginBottom: "12px",
            lineHeight: 1.4,
          }}
        >
          {form.description}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {form.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? (q.type === 'checkbox' ? [] : '')}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!allRequired}
        style={{
          marginTop: "16px",
          background: "var(--accent-primary, #6366f1)",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "8px 16px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: allRequired ? "pointer" : "not-allowed",
          opacity: allRequired ? 1 : 0.5,
          transition: "opacity 0.15s",
        }}
      >
        Submit
      </button>
    </div>
  );
}
