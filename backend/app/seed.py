"""Seed script – run with: cd backend && uv run python -m app.seed"""

from app.core.database import init_db, get_session
from app.core.security import hash_password
from app.models import (
    ApprovalFlow,
    ApprovalLog,
    ApprovalStep,
    Company,
    EmployeeManagerMap,
    Expense,
    ExpenseStatus,
    Role,
    User,
)
from datetime import datetime, timedelta


def seed():
    init_db()
    session = next(get_session())

    # ── Company ──────────────────────────────
    company = Company(name="Acme Corp", country="India", default_currency="INR")
    session.add(company)
    session.commit()
    session.refresh(company)
    print(f"✓ Company: {company.name} (ID {company.id})")

    # ── Admin ────────────────────────────────
    admin = User(
        name="Admin User", email="admin@acme.com",
        password_hash=hash_password("admin123"), role=Role.admin, company_id=company.id,
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)

    # ── Managers ─────────────────────────────
    mgr1 = User(
        name="Sarah Manager", email="sarah@acme.com",
        password_hash=hash_password("manager123"), role=Role.manager, company_id=company.id,
    )
    mgr2 = User(
        name="John Director", email="john@acme.com",
        password_hash=hash_password("manager123"), role=Role.manager, company_id=company.id,
    )
    session.add_all([mgr1, mgr2])
    session.commit()
    session.refresh(mgr1)
    session.refresh(mgr2)

    # ── Employees ────────────────────────────
    emp1 = User(
        name="Marc Employee", email="marc@acme.com",
        password_hash=hash_password("employee123"), role=Role.employee, company_id=company.id,
    )
    emp2 = User(
        name="Alice Engineer", email="alice@acme.com",
        password_hash=hash_password("employee123"), role=Role.employee, company_id=company.id,
    )
    emp3 = User(
        name="Raj Developer", email="raj@acme.com",
        password_hash=hash_password("employee123"), role=Role.employee, company_id=company.id,
    )
    session.add_all([emp1, emp2, emp3])
    session.commit()
    session.refresh(emp1)
    session.refresh(emp2)
    session.refresh(emp3)

    # ── Manager Mappings ─────────────────────
    session.add(EmployeeManagerMap(employee_id=emp1.id, manager_id=mgr1.id))
    session.add(EmployeeManagerMap(employee_id=emp2.id, manager_id=mgr1.id))
    session.add(EmployeeManagerMap(employee_id=emp3.id, manager_id=mgr2.id))
    session.commit()

    # ── Approval Flows ───────────────────────
    for emp in [emp1, emp2, emp3]:
        flow = ApprovalFlow(
            company_id=company.id, user_id=emp.id,
            description=f"Standard approval for {emp.name}",
            manager_first=True, sequential=True,
            min_approval_percentage=60,
            approvers=[mgr1.id, mgr2.id],
            required_approvers=[mgr1.id],
        )
        session.add(flow)
    session.commit()

    # ── Marc's Expenses (varied statuses) ────
    now = datetime.utcnow()

    # Draft expenses
    draft1 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=567, currency="USD", converted_amount=47250, base_currency="INR",
        category="Food", description="Client dinner at Nobu",
        paid_by="Self", expense_date=now - timedelta(days=1),
        remarks="Business dinner with Globex prospect", status=ExpenseStatus.draft,
    )
    draft2 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=89, currency="USD", converted_amount=7400, base_currency="INR",
        category="Travel", description="Uber rides — airport round trip",
        paid_by="Self", expense_date=now - timedelta(days=2),
        remarks="", status=ExpenseStatus.draft,
    )

    # Pending expenses (submitted, waiting for approval)
    pending1 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=1200, currency="INR", converted_amount=1200, base_currency="INR",
        category="Travel", description="Train ticket — Mumbai to Pune",
        paid_by="Self", expense_date=now - timedelta(days=5),
        remarks="Quarterly review meeting", status=ExpenseStatus.pending,
    )
    pending2 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=340, currency="EUR", converted_amount=30800, base_currency="INR",
        category="Lodging", description="Hotel — Berlin tech summit",
        paid_by="Company Card", expense_date=now - timedelta(days=8),
        remarks="2 night stay for conference", status=ExpenseStatus.pending,
    )

    # Approved expenses
    approved1 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=2500, currency="INR", converted_amount=2500, base_currency="INR",
        category="Food", description="Team lunch — sprint celebration",
        paid_by="Self", expense_date=now - timedelta(days=15),
        remarks="End of Q4 sprint", status=ExpenseStatus.approved,
    )
    approved2 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=150, currency="USD", converted_amount=12500, base_currency="INR",
        category="Miscellaneous", description="Software license — Figma Pro",
        paid_by="Self", expense_date=now - timedelta(days=20),
        remarks="Annual renewal", status=ExpenseStatus.approved,
    )
    approved3 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=780, currency="INR", converted_amount=780, base_currency="INR",
        category="Travel", description="Ola cab — client site visit",
        paid_by="Self", expense_date=now - timedelta(days=22),
        remarks="", status=ExpenseStatus.approved,
    )

    # Rejected expense
    rejected1 = Expense(
        user_id=emp1.id, company_id=company.id,
        amount=4500, currency="USD", converted_amount=375000, base_currency="INR",
        category="Lodging", description="Luxury resort — offsite",
        paid_by="Self", expense_date=now - timedelta(days=30),
        remarks="Team offsite retreat", status=ExpenseStatus.rejected,
    )

    session.add_all([draft1, draft2, pending1, pending2, approved1, approved2, approved3, rejected1])
    session.commit()

    # Refresh to get IDs
    for exp in [draft1, draft2, pending1, pending2, approved1, approved2, approved3, rejected1]:
        session.refresh(exp)

    # ── Approval Steps for pending expenses ──
    for exp in [pending1, pending2]:
        session.add(ApprovalStep(expense_id=exp.id, approver_id=mgr1.id, sequence_order=1, required=True, status="pending"))
        session.add(ApprovalStep(expense_id=exp.id, approver_id=mgr2.id, sequence_order=2, required=False, status="pending"))
    session.commit()

    # ── Approval Logs for approved expenses ──
    for exp in [approved1, approved2, approved3]:
        session.add(ApprovalLog(
            expense_id=exp.id, approver_id=mgr1.id,
            decision="approved", comment="Looks good, approved.",
            timestamp=exp.expense_date + timedelta(days=1),
        ))
    # Rejection log
    session.add(ApprovalLog(
        expense_id=rejected1.id, approver_id=mgr1.id,
        decision="rejected", comment="Exceeds budget. Please use the approved hotel list.",
        timestamp=rejected1.expense_date + timedelta(days=1),
    ))
    session.commit()

    # ── Alice's Expenses ─────────────────────
    alice_pending = Expense(
        user_id=emp2.id, company_id=company.id,
        amount=250, currency="EUR", converted_amount=22500, base_currency="INR",
        category="Lodging", description="Hotel — annual conference",
        paid_by="Company Card", expense_date=now - timedelta(days=3),
        remarks="Tech conference in Amsterdam", status=ExpenseStatus.pending,
    )
    alice_approved = Expense(
        user_id=emp2.id, company_id=company.id,
        amount=180, currency="USD", converted_amount=15000, base_currency="INR",
        category="Food", description="Client dinner — SaaS onboarding",
        paid_by="Self", expense_date=now - timedelta(days=12),
        remarks="", status=ExpenseStatus.approved,
    )
    alice_draft = Expense(
        user_id=emp2.id, company_id=company.id,
        amount=45, currency="USD", converted_amount=3750, base_currency="INR",
        category="Miscellaneous", description="Office supplies — keyboard",
        paid_by="Self", expense_date=now - timedelta(days=1),
        remarks="Ergonomic keyboard", status=ExpenseStatus.draft,
    )
    session.add_all([alice_pending, alice_approved, alice_draft])
    session.commit()
    for exp in [alice_pending, alice_approved, alice_draft]:
        session.refresh(exp)

    session.add(ApprovalStep(expense_id=alice_pending.id, approver_id=mgr1.id, sequence_order=1, required=True, status="pending"))
    session.add(ApprovalLog(
        expense_id=alice_approved.id, approver_id=mgr1.id,
        decision="approved", comment="Approved — standard client expense.",
        timestamp=alice_approved.expense_date + timedelta(days=2),
    ))
    session.commit()

    # ── Raj's Expenses ───────────────────────
    raj_pending = Expense(
        user_id=emp3.id, company_id=company.id,
        amount=950, currency="INR", converted_amount=950, base_currency="INR",
        category="Travel", description="Metro card recharge — monthly",
        paid_by="Self", expense_date=now - timedelta(days=2),
        remarks="Monthly commute", status=ExpenseStatus.pending,
    )
    raj_approved = Expense(
        user_id=emp3.id, company_id=company.id,
        amount=3200, currency="INR", converted_amount=3200, base_currency="INR",
        category="Food", description="Team snacks — hackathon",
        paid_by="Self", expense_date=now - timedelta(days=10),
        remarks="Hackathon day supplies", status=ExpenseStatus.approved,
    )
    session.add_all([raj_pending, raj_approved])
    session.commit()
    for exp in [raj_pending, raj_approved]:
        session.refresh(exp)

    session.add(ApprovalStep(expense_id=raj_pending.id, approver_id=mgr2.id, sequence_order=1, required=True, status="pending"))
    session.add(ApprovalLog(
        expense_id=raj_approved.id, approver_id=mgr2.id,
        decision="approved", comment="Fine.",
        timestamp=raj_approved.expense_date + timedelta(days=1),
    ))
    session.commit()

    print(f"✓ Admin: admin@acme.com / admin123")
    print(f"✓ Manager: sarah@acme.com / manager123")
    print(f"✓ Manager: john@acme.com / manager123")
    print(f"✓ Employee: marc@acme.com / employee123  (8 expenses)")
    print(f"✓ Employee: alice@acme.com / employee123  (3 expenses)")
    print(f"✓ Employee: raj@acme.com / employee123  (2 expenses)")
    print(f"✓ Approval logs & steps seeded for realistic data")
    print()
    print("=" * 50)
    print("  SEED COMPLETE")
    print("=" * 50)
    print()
    print("── SMTP (Forgot Password) ─────────────────────")
    print("  To enable email-based password reset:")
    print("  1. Go to https://myaccount.google.com/apppasswords")
    print("  2. Generate a new App Password for 'Mail'")
    print("  3. Set in backend/.env:")
    print("     smtp_user=your_gmail@gmail.com")
    print("     smtp_password=xxxx xxxx xxxx xxxx")
    print()
    print("  Without SMTP configured, reset links will be")
    print("  printed to the backend console instead.")
    print("=" * 50)


if __name__ == "__main__":
    seed()
