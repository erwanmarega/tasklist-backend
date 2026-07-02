import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import testPrisma from "./setup.js";

vi.mock("../../lib/prisma.js", () => ({
  default: testPrisma,
}));

const { default: app } = await import("../../app.js");
import request from "supertest";

const createTask = (data: { title: string; description?: string }) =>
  testPrisma.task.create({ data });

const withDbError = async <K extends keyof typeof testPrisma.task>(
  method: K,
  fn: () => Promise<void>,
) => {
  const original = testPrisma.task[method];
  testPrisma.task[method] = vi
    .fn()
    .mockRejectedValueOnce(new Error("DB crash")) as any;
  try {
    await fn();
  } finally {
    testPrisma.task[method] = original;
  }
};

describe("Task API E2E Tests", () => {
  beforeEach(async () => {
    await testPrisma.task.deleteMany();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  describe("POST /api/tasks", () => {
    it("creates a task with title and description", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "E2E Task", description: "E2E Description" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: "E2E Task",
        description: "E2E Description",
        completed: false,
      });
      expect(res.body).toHaveProperty("id");
    });

    it("creates a task without description", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "No Description Task" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("No Description Task");
      expect(res.body.description).toBeNull();
    });

    it("rejects missing title with 400", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ description: "No title" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("rejects blank title with 400", async () => {
      const res = await request(app).post("/api/tasks").send({ title: "   " });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 500 on DB error", async () => {
      await withDbError("create", async () => {
        const res = await request(app)
          .post("/api/tasks")
          .send({ title: "Fail Task" });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });
  });

  describe("GET /api/tasks", () => {
    it("returns an empty array when there are no tasks", async () => {
      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns all tasks ordered by createdAt desc", async () => {
      await createTask({ title: "First Task" });
      await createTask({ title: "Second Task" });

      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("Second Task");
      expect(res.body[1].title).toBe("First Task");
    });

    it("returns 500 on DB error", async () => {
      await withDbError("findMany", async () => {
        const res = await request(app).get("/api/tasks");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("returns a task by id", async () => {
      const task = await createTask({ title: "Find Me" });

      const res = await request(app).get(`/api/tasks/${task.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: task.id, title: "Find Me" });
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await request(app).get("/api/tasks/99999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when the id is invalid", async () => {
      const res = await request(app).get("/api/tasks/abc");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 500 on DB error", async () => {
      await withDbError("findUnique", async () => {
        const res = await request(app).get("/api/tasks/1");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("updates the task title", async () => {
      const task = await createTask({ title: "Old Title" });

      const res = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("New Title");
    });

    it("marks the task as completed", async () => {
      const task = await createTask({ title: "Task" });

      const res = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await request(app)
        .put("/api/tasks/99999")
        .send({ title: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when the id is invalid", async () => {
      const res = await request(app)
        .put("/api/tasks/abc")
        .send({ title: "Updated" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 500 on non-404 DB error", async () => {
      const task = await createTask({ title: "Fail Update" });

      await withDbError("update", async () => {
        const res = await request(app)
          .put(`/api/tasks/${task.id}`)
          .send({ title: "New" });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("deletes the task and returns 204", async () => {
      const task = await createTask({ title: "Delete Me" });

      const res = await request(app).delete(`/api/tasks/${task.id}`);

      expect(res.status).toBe(204);
      expect(
        await testPrisma.task.findUnique({ where: { id: task.id } }),
      ).toBeNull();
    });

    it("returns 404 when the task does not exist", async () => {
      const res = await request(app).delete("/api/tasks/99999");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when the id is invalid", async () => {
      const res = await request(app).delete("/api/tasks/abc");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 500 when the lookup fails", async () => {
      const task = await createTask({ title: "Fail Delete" });

      await withDbError("findUnique", async () => {
        const res = await request(app).delete(`/api/tasks/${task.id}`);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });

    it("returns 500 on non-404 delete error", async () => {
      const task = await createTask({ title: "Fail Delete 2" });

      await withDbError("delete", async () => {
        const res = await request(app).delete(`/api/tasks/${task.id}`);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
      });
    });
  });
});
