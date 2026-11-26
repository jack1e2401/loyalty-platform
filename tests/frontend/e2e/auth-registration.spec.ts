import { expect, test } from "@playwright/test";

test("landing keeps member entry points and has no platform controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Mua ở nơi bạn yêu/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Tạo tài khoản" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: /Trạng thái hồ sơ|Admin/i })).toHaveCount(0);

  for (const removedPath of ["/admin", "/admin/applications", "/application/status"]) {
    await page.goto(removedPath);
    await expect(page).toHaveURL(/\/$/);
  }
});

test("Member registration posts credentials and confirms the backend response", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/auth/register/member", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: 8, email: "member@test.local", role: "MEMBER", isActive: true } }),
    });
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("member@test.local");
  await page.getByLabel("Mật khẩu").fill("member-password-123");
  await page.getByRole("button", { name: "Tạo tài khoản Member" }).click();

  await expect(page.getByText("Tài khoản đã sẵn sàng")).toBeVisible();
  expect(requestBody).toEqual({ email: "member@test.local", password: "member-password-123" });
  expect(await page.evaluate(() => sessionStorage.getItem("loyalty.m2.session"))).toBeNull();
});
