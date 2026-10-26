import React from "react";
import { Link } from "react-router-dom";
import { Compass, ArrowLeft } from "lucide-react";

export const NotFoundPage = () => {
  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "100px auto",
        padding: "0 20px",
        textAlign: "center",
      }}
    >
      <div className="glass-panel" style={{ padding: "48px 32px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(99, 102, 241, 0.12)",
            color: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Compass size={36} />
        </div>
        <h1 style={{ fontSize: "3rem", marginBottom: "8px", fontWeight: 800 }}>
          404
        </h1>
        <h3 style={{ marginBottom: "12px" }}>Page Not Found</h3>
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: "28px",
            fontSize: "0.95rem",
          }}
        >
          The page or resource you are looking for doesn't exist or has been
          moved.
        </p>
        <Link
          to="/dashboard"
          className="btn btn-primary btn-lg"
          style={{ display: "inline-flex" }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};
