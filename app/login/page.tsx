import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/session";
import styles from "./styles.module.css";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-label="Authentication">
        <div className={styles.copy}>
          <p className={styles.brand}>Agent Board</p>
          <h1>Plan work for humans and agents in the same flow.</h1>
          <p>
            Start with a clean team board, connect the repositories your team
            works in, and write tickets that read naturally to anyone.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
