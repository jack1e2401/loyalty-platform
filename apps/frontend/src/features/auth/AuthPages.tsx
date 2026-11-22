import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useAuthSession, routeForRole } from "../../api/auth-session";
import { Button, BusyLabel, Card, Field, Input } from "../../components/ui";

function resolveSafeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
  if (trimmed.startsWith("/login") || trimmed.startsWith("/register")) return null;
  return trimmed;
}

function explainAuthError(message: string) {
  const explanations: Record<string, string> = {
    INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
    ACCOUNT_INACTIVE: "Tài khoản đang bị vô hiệu hóa.",
    ACCOUNT_SUSPENDED: "Tài khoản đang bị tạm khóa.",
    ACCOUNT_BANNED: "Tài khoản không thể đăng nhập.",
    MERCHANT_NOT_ACTIVE: "Cửa hàng chưa được cấu hình để đăng nhập.",
  };
  return explanations[message] ?? message;
}

function AuthFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="grid min-h-[100dvh] bg-[#f7f8f4] lg:grid-cols-2">
      <section className="relative hidden min-h-[100dvh] overflow-hidden bg-[#23442e] p-10 lg:flex lg:items-end">
        <img src="/images/independent-cafe.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#142b1c]/45 via-[#183321]/10 to-[#173321]/80" />
        <div className="absolute left-12 top-10 flex items-center gap-3 text-xl font-extrabold text-white">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c4f093] text-[#24442c]">L</span>
          loyalty.
        </div>
        <div className="relative mb-12 max-w-md text-white">
          <p className="serif text-4xl leading-tight tracking-[-.04em]">Thân quen hơn qua từng lần ghé lại.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-[#55715a]">
            <ArrowLeft size={16} /> Về trang đầu
          </Link>
          <Card className="p-6 sm:p-9">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#20392a]">{title}</h2>
            <div className="mt-7">{children}</div>
          </Card>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const { user, login } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={returnTo ?? routeForRole(user.role)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login({ email, password });
      navigate(returnTo ?? routeForRole(result.user.role), { replace: true });
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setError(explainAuthError(code || "Không thể đăng nhập."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Đăng nhập">
      {searchParams.get("registered") === "member" && (
        <p role="status" className="mb-4 rounded-xl bg-[#edf4e9] p-3 text-sm text-[#376743]">
          Tài khoản Member đã được tạo. Đăng nhập để tiếp tục.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required maxLength={191} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" />
        </Field>
        <Field label="Mật khẩu">
          <Input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" />
        </Field>
        {error && <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm leading-6 text-[#a4473a]">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <BusyLabel>Đang xác thực</BusyLabel> : <>Đăng nhập <ArrowRight size={17} /></>}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm muted">
        Chưa có tài khoản? <Link className="font-bold accent" to={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : "/register"}>Tạo tài khoản Member</Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { registerMember } = useAuthSession();
  const [searchParams] = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registeredMember, setRegisteredMember] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await registerMember({ email, password });
      setRegisteredMember(email);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "Không thể tạo tài khoản.";
      setError(code === "EMAIL_TAKEN" ? "Email này đã được đăng ký." : code === "INVALID_INPUT" ? "Email hoặc mật khẩu chưa hợp lệ." : code);
    } finally {
      setBusy(false);
    }
  }

  if (registeredMember) {
    const loginAfterRegister = returnTo
      ? `/login?registered=member&returnTo=${encodeURIComponent(returnTo)}`
      : "/login?registered=member";
    return (
      <AuthFrame title="Tài khoản đã sẵn sàng">
        <div className="rounded-2xl bg-[#edf4e9] p-5">
          <h3 className="text-lg font-extrabold">Đăng ký thành công</h3>
          <p className="mt-2 text-sm leading-6 text-[#5d715f]">{registeredMember} đã được tạo. Đăng nhập để tiếp tục.</p>
        </div>
        <Link to={loginAfterRegister} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#335e3d] text-sm font-bold text-white">
          Đăng nhập <ArrowRight size={16} />
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Tạo tài khoản Member">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required maxLength={191} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" />
        </Field>
        <Field label="Mật khẩu" hint="Từ 12 đến 128 ký tự.">
          <Input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tạo mật khẩu mạnh" />
        </Field>
        {error && <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm text-[#a4473a]">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? <BusyLabel>Đang tạo</BusyLabel> : "Tạo tài khoản Member"}</Button>
      </form>
      <p className="mt-6 text-center text-sm muted">
        Đã có tài khoản? <Link className="font-bold accent" to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}>Đăng nhập</Link>
      </p>
    </AuthFrame>
  );
}
