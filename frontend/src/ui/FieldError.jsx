import React from "react";

export default function FieldError({ message }) {
  return message && <div className="fieldError">{message}</div>;
}
