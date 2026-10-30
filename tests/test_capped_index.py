import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from capped_index import capped_weights, portfolio_value, rebalance

class CapTests(unittest.TestCase):
    def test_iterative_redistribution_caps_second_name(self):
        values={'Eternal':40,'Paytm':9,**{str(i):51/45 for i in range(45)}}
        weights=capped_weights(values)
        self.assertAlmostEqual(weights['Eternal'],.1)
        self.assertAlmostEqual(weights['Paytm'],.1)
        self.assertAlmostEqual(sum(weights.values()),1)
        self.assertAlmostEqual(weights['0'],.8/45)

    def test_uncapped_small_names_preserve_relative_weights(self):
        weights=capped_weights({str(i):i+1 for i in range(47)})
        self.assertAlmostEqual(weights['1']/weights['0'],2)

    def test_continuity_and_drift_between_rebalances(self):
        holdings={str(i):{'fs':100 if i==0 else 1,'currency':'INR'} for i in range(47)}
        prices={k:10 for k in holdings}
        units,weights=rebalance(130,holdings,prices)
        self.assertAlmostEqual(portfolio_value(units,holdings,prices),130)
        prices['0']=11
        level=portfolio_value(units,holdings,prices)
        self.assertAlmostEqual(level,131.3)
        self.assertGreater(units['0']*11/level,.1)
        units,weights=rebalance(level,holdings,prices)
        self.assertAlmostEqual(portfolio_value(units,holdings,prices),level)
        self.assertAlmostEqual(weights['0'],.1)

    def test_fx_changes_value_without_recap(self):
        holdings={str(i):{'fs':1,'currency':'USD' if i==0 else 'INR'} for i in range(47)}
        prices={str(i):(1 if i==0 else 100) for i in range(47)}
        units,_=rebalance(100,holdings,prices,fx=100)
        self.assertAlmostEqual(portfolio_value(units,holdings,prices,fx=110),100+10/47)

    def test_missing_inputs_fail_instead_of_dropping_holdings(self):
        with self.assertRaises(ValueError): capped_weights({'a':1,'b':1})
        with self.assertRaises(ValueError): capped_weights({str(i):0 for i in range(47)})
        with self.assertRaises(ValueError): portfolio_value({'a':1},{'a':{'currency':'INR'}},{})

if __name__=='__main__': unittest.main()
