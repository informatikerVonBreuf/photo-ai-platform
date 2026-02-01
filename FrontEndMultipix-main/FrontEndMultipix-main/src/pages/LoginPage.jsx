import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  function submit(e) {
    e.preventDefault();
    localStorage.setItem("mpx_token", "dev-token");
    localStorage.setItem("mpx_user", JSON.stringify({ email }));
    nav("/libraries");
  }

  return (
    <div className="auth">
      <div className="authLayout">
        <div className="authBrand">
          <div className="authLogo">
            <img src="/Logo/logotransparent3.png" alt="Multipix" />
          </div>
          <div className="authTitle">Multipix</div>
          <div className="authSub">Connecte-toi pour gérer tes libraries & tes recherches.</div>
        </div>

        <div className="card authCard">
          <form className="authForm" onSubmit={submit}>
            <label className="field">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ex: choun@email.com" />
            </label>
            <label className="field">
              Mot de passe
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
            </label>

            <button className="btn primary">Se connecter</button>
            <div className="mutedSmall">(Dev) Login simulé. JWT + logs ensuite.</div>
          </form>
        </div>
      </div>
    </div>
  );
}
