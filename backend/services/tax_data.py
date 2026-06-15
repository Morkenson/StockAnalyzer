"""Tax tables used by the estimated tax calculator.

2025 federal amounts are from IRS IR-2024-273 / Revenue Procedure 2024-40.
2025 Social Security wage base is from the Social Security Administration.
Wisconsin brackets use 2025 state individual income tax bracket thresholds.
"""

DEFAULT_TAX_YEAR = 2025

STANDARD_DEDUCTIONS = {
    2025: {
        "single": 15000,
        "married_joint": 30000,
        "head_of_household": 22500,
    }
}

FEDERAL_BRACKETS = {
    2025: {
        "single": [
            (0, 11925, 0.10),
            (11925, 48475, 0.12),
            (48475, 103350, 0.22),
            (103350, 197300, 0.24),
            (197300, 250525, 0.32),
            (250525, 626350, 0.35),
            (626350, None, 0.37),
        ],
        "married_joint": [
            (0, 23850, 0.10),
            (23850, 96950, 0.12),
            (96950, 206700, 0.22),
            (206700, 394600, 0.24),
            (394600, 501050, 0.32),
            (501050, 751600, 0.35),
            (751600, None, 0.37),
        ],
        "head_of_household": [
            (0, 17000, 0.10),
            (17000, 64850, 0.12),
            (64850, 103350, 0.22),
            (103350, 197300, 0.24),
            (197300, 250500, 0.32),
            (250500, 626350, 0.35),
            (626350, None, 0.37),
        ],
    }
}

FICA = {
    2025: {
        "social_security_rate": 0.062,
        "social_security_wage_base": 176100,
        "medicare_rate": 0.0145,
        "additional_medicare_rate": 0.009,
        "additional_medicare_thresholds": {
            "single": 200000,
            "married_joint": 250000,
            "head_of_household": 200000,
        },
    }
}

WISCONSIN_BRACKETS = {
    2025: {
        "single": [
            (0, 14680, 0.035),
            (14680, 29370, 0.044),
            (29370, 323290, 0.053),
            (323290, None, 0.0765),
        ],
        "married_joint": [
            (0, 19580, 0.035),
            (19580, 39150, 0.044),
            (39150, 431060, 0.053),
            (431060, None, 0.0765),
        ],
        "head_of_household": [
            (0, 14680, 0.035),
            (14680, 29370, 0.044),
            (29370, 323290, 0.053),
            (323290, None, 0.0765),
        ],
    }
}
