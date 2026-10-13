import pytest
import pandas as pd
import numpy as np
from ecg_intelligence import CLASSES
from ecg_intelligence.data.labels import map_scp_to_superclasses


def test_map_scp_to_superclasses():
    # Mock aggregation statements table
    agg = pd.DataFrame({
        'diagnostic': [1, 1, 1, 0],
        'diagnostic_class': ['NORM', 'MI', 'STTC', 'NORM']
    }, index=['SR', 'AMI', 'STTC_CODE', 'NON_DIAG'])

    # Mock metadata dataframe
    df = pd.DataFrame({
        'scp_codes': [
            {'SR': 100.0},
            {'AMI': 100.0, 'STTC_CODE': 80.0},
            {'NON_DIAG': 50.0},  # should be dropped
            {'UNKNOWN_CODE': 100.0}  # should be dropped
        ]
    })

    filtered_df, Y = map_scp_to_superclasses(df, agg, classes=CLASSES)

    # 2 rows should remain
    assert len(filtered_df) == 2
    assert Y.shape == (2, len(CLASSES))

    # Row 0 is NORM
    norm_idx = CLASSES.index('NORM')
    assert Y[0, norm_idx] == 1.0

    # Row 1 is MI and STTC
    mi_idx = CLASSES.index('MI')
    sttc_idx = CLASSES.index('STTC')
    assert Y[1, mi_idx] == 1.0
    assert Y[1, sttc_idx] == 1.0
