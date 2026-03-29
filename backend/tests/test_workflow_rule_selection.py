import unittest
from datetime import datetime

from app.models import ApprovalFlow, Expense
from app.services.workflow import select_applicable_flow


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, flows):
        self._flows = flows

    def exec(self, _query):
        return _FakeResult(self._flows)


def _flow(
    flow_id,
    *,
    category=None,
    min_amount=None,
    max_amount=None,
    priority=0,
    is_active=True,
):
    return ApprovalFlow(
        id=flow_id,
        company_id=1,
        user_id=10,
        description=f"flow-{flow_id}",
        category=category,
        min_amount=min_amount,
        max_amount=max_amount,
        priority=priority,
        is_active=is_active,
        manager_first=True,
        sequential=True,
        min_approval_percentage=60,
        approvers=[2, 3],
        required_approvers=[2],
    )


def _expense(*, category="Food", converted_amount=1200.0):
    return Expense(
        id=1,
        user_id=10,
        company_id=1,
        amount=100.0,
        currency="USD",
        converted_amount=converted_amount,
        base_currency="INR",
        category=category,
        description="lunch",
        paid_by="self",
        expense_date=datetime.utcnow(),
        remarks="",
    )


class WorkflowRuleSelectionTests(unittest.TestCase):
    def test_backward_compatible_global_flow_is_selected(self):
        session = _FakeSession([_flow(1)])
        chosen = select_applicable_flow(session, _expense())
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen.id, 1)

    def test_category_specific_flow_beats_generic_flow(self):
        session = _FakeSession([_flow(1), _flow(2, category="Food")])
        chosen = select_applicable_flow(session, _expense(category="Food"))
        self.assertEqual(chosen.id, 2)

    def test_amount_threshold_flow_selected_when_matched(self):
        session = _FakeSession([_flow(1), _flow(2, min_amount=1000.0, max_amount=3000.0)])
        chosen = select_applicable_flow(session, _expense(converted_amount=1500.0))
        self.assertEqual(chosen.id, 2)

    def test_higher_priority_wins_when_specificity_equal(self):
        session = _FakeSession(
            [
                _flow(1, category="Food", priority=1),
                _flow(2, category="Food", priority=10),
            ]
        )
        chosen = select_applicable_flow(session, _expense(category="Food"))
        self.assertEqual(chosen.id, 2)

    def test_lowest_id_wins_when_specificity_and_priority_equal(self):
        session = _FakeSession(
            [
                _flow(9, category="Food", priority=5),
                _flow(3, category="Food", priority=5),
            ]
        )
        chosen = select_applicable_flow(session, _expense(category="Food"))
        self.assertEqual(chosen.id, 3)

    def test_inactive_flows_are_ignored(self):
        session = _FakeSession([_flow(1, is_active=False), _flow(2)])
        chosen = select_applicable_flow(session, _expense())
        self.assertEqual(chosen.id, 2)


if __name__ == "__main__":
    unittest.main()
